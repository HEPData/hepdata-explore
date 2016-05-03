from flask_sqlalchemy import SQLAlchemy
from kv_server.app import app

db = SQLAlchemy(app)


class State(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    value = db.Column(db.Text(), unique=False)
    ip = db.Column(db.String(45))
    created = db.Column(db.DateTime())

    def __init__(self, id, value, ip, created):
        self.id = id
        self.value = value
        self.ip = ip
        self.created = created

    def __repr__(self):
        return '<State %r>' % self.id

