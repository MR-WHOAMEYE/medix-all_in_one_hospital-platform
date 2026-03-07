import os
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()
uri = os.getenv("mongo_db", "")
client = MongoClient(uri, serverSelectionTimeoutMS=10000)
db = client["zero_intercept"]
col = db["otps"]
for doc in col.find({}, {"_id": 0}):
    print(doc)
