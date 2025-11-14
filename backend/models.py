# models.py — ORM models for foods, users, meals, recipes, badges
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from db import Base
import datetime

class Food(Base):
    __tablename__ = "foods"
    id = Column(Integer, primary_key=True)
    name = Column(String, index=True, nullable=False)
    canonical = Column(String, index=True)
    brand = Column(String, nullable=True)
    # store a JSON object with nutrient name -> value (per serving)
    nutrients = Column(JSON, default={})
    # unit (e.g. "g", "kcal", "serving")
    serving_size = Column(Float, nullable=True)
    serving_unit = Column(String, nullable=True)
    tags = Column(String, nullable=True)  # comma-separated tags
    # common variants stored as JSON: [{"variant":"mini","mult":0.6},{"variant":"half","mult":0.5}]
    variants = Column(JSON, default=[])
    source = Column(String, nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=True)
    display_name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    sex = Column(String, nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    activity_level = Column(String, nullable=True)
    # goals: json { calories: 2000, protein_g: 75, carbs_g: 250, fat_g: 70 }
    goals = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MealLog(Base):
    __tablename__ = "meal_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    food_id = Column(Integer, ForeignKey("foods.id"), nullable=True)
    item_name = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    portion_mult = Column(Float, default=1.0)
    manual_calories = Column(Float, nullable=True)
    nutrients_snapshot = Column(JSON, default={})
    source = Column(String, default="manual")  # "ocr", "manual", "csv"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", backref="meal_logs")
    food = relationship("Food", backref="meal_logs")

class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    items = Column(JSON, default=[])  # list of {food_id or name, qty, portion}
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Badge(Base):
    __tablename__ = "badges"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    badge_key = Column(String, index=True)
    earned_at = Column(DateTime, default=datetime.datetime.utcnow)
