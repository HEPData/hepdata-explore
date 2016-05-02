from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////tmp/test.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
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

