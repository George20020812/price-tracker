from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
from datetime import datetime

# --- App Configuration ---
app = Flask(__name__)
CORS(app) # 允許所有來源的跨域請求，方便擴充功能呼叫

# 資料庫設定
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'tracker.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Database Models (資料庫模型) ---
class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(512), unique=True, nullable=False)
    items = db.relationship('TrackedItem', backref='post', lazy=True)

class TrackedItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_name = db.Column(db.String(255), nullable=False)
    current_price = db.Column(db.Float, nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    prices = db.relationship('PriceHistory', backref='item', lazy=True, cascade="all, delete-orphan")

class PriceHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey('tracked_item.id'), nullable=False)
    price = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# --- API Routes (API 路由) ---
@app.route('/api/items', methods=['POST'])
def add_item():
    data = request.get_json()
    if not data or 'postUrl' not in data or 'items' not in data or not isinstance(data['items'], list) or not data['items']:
        return jsonify({'status': 'error', 'message': 'Missing or invalid data (postUrl or items array required)'}), 400

    post_url = data['postUrl']
    items_to_track = data['items']

    # 步驟 1: 查找或創建 Post
    post = Post.query.filter_by(url=post_url).first()
    if not post:
        post = Post(url=post_url)
        db.session.add(post)
        db.session.commit() # 提交以獲取 post.id

    tracked_item_ids = []
    for item_data in items_to_track:
        item_name = item_data.get('name')
        item_price = item_data.get('price')

        if not item_name or not isinstance(item_price, (int, float)) or item_price <= 0:
            # Log error or skip invalid item, or return error for the whole request
            print(f"Skipping invalid item: {item_data}")
            continue

        # 步驟 2: 創建 TrackedItem
        new_item = TrackedItem(
            item_name=item_name,
            current_price=item_price,
            post_id=post.id
        )
        db.session.add(new_item)
        db.session.commit() # 提交以獲取 new_item.id
        tracked_item_ids.append(new_item.id)
        
        # 步驟 3: 創建第一筆 PriceHistory
        initial_price = PriceHistory(
            item_id=new_item.id,
            price=item_price
        )
        db.session.add(initial_price)
    
    db.session.commit() # 最終提交所有變更
    
    if not tracked_item_ids:
        return jsonify({'status': 'error', 'message': 'No valid items were tracked.'}), 400

    return jsonify({'status': 'success', 'message': f'{len(tracked_item_ids)} items tracked successfully', 'tracked_item_ids': tracked_item_ids}), 201

@app.route('/api/items', methods=['GET'])
def get_all_items():
    items = TrackedItem.query.order_by(TrackedItem.created_at.desc()).all()
    output = []
    for item in items:
        item_data = {
            'id': item.id,
            'itemName': item.item_name,
            'currentPrice': item.current_price,
            'postUrl': item.post.url,
            'createdAt': item.created_at.isoformat()
        }
        output.append(item_data)
    return jsonify(output)

# New route for price history
@app.route('/api/items/<int:item_id>/history', methods=['GET'])
def get_item_history(item_id):
    item = TrackedItem.query.get(item_id)
    if not item:
        return jsonify({'status': 'error', 'message': 'Item not found'}), 404

    history = PriceHistory.query.filter_by(item_id=item_id).order_by(PriceHistory.timestamp.asc()).all()
    output = []
    for entry in history:
        output.append({
            'price': entry.price,
            'timestamp': entry.timestamp.isoformat() # ISO format for easy JS parsing
        })
    return jsonify(output)

# New route for deleting an item
@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    item = TrackedItem.query.get(item_id)
    if not item:
        return jsonify({'status': 'error', 'message': 'Item not found'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Item deleted successfully'}), 200


# --- CLI Commands ---
@app.cli.command('init-db')
def init_db_command():
    """Clear existing data and create new tables."""
    with app.app_context():
        db.create_all()
    print('Initialized the database.')

@app.cli.command('insert-sample-data')
def insert_sample_data_command():
    """Insert sample price history data for testing."""
    with app.app_context():
        sample_data = [
            {"price": 100.00, "timestamp": "2024-01-01T10:00:00Z"},
            {"price": 95.50, "timestamp": "2024-01-05T14:30:00Z"},
            {"price": 102.20, "timestamp": "2024-01-10T09:15:00Z"},
            {"price": 98.00, "timestamp": "2024-01-15T11:00:00Z"},
            {"price": 105.75, "timestamp": "2024-01-20T16:45:00Z"},
            {"price": 103.00, "timestamp": "2024-01-25T08:00:00Z"},
            {"price": 110.50, "timestamp": "2024-02-01T12:00:00Z"},
            {"price": 108.20, "timestamp": "2024-02-05T10:00:00Z"},
            {"price": 115.00, "timestamp": "2024-02-10T14:00:00Z"},
            {"price": 112.50, "timestamp": "2024-02-15T09:00:00Z"}
        ]

        dummy_post_url = "https://www.example.com/sample_product_post"
        dummy_item_name = "範例追蹤商品"

        # Find or create Post
        post = Post.query.filter_by(url=dummy_post_url).first()
        if not post:
            post = Post(url=dummy_post_url)
            db.session.add(post)
            db.session.commit()

        # Create TrackedItem
        item = TrackedItem(
            item_name=dummy_item_name,
            current_price=sample_data[-1]['price'], # Set current price to the last price in sample data
            post_id=post.id
        )
        db.session.add(item)
        db.session.commit()

        # Insert PriceHistory records
        for entry in sample_data:
            price_history = PriceHistory(
                item_id=item.id,
                price=entry['price'],
                timestamp=datetime.fromisoformat(entry['timestamp'].replace('Z', '+00:00')) # Handle Z for UTC
            )
            db.session.add(price_history)
        
        db.session.commit()
        print(f'Inserted sample data for "{dummy_item_name}" into the database.')
