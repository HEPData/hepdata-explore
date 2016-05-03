from datetime import datetime
import json

from flask import request, Response
from sqlalchemy.exc import IntegrityError

from kv_server.app import something_fishy, app
from kv_server.custom_url_hash import url_string_to_number, custom_url_hash
from kv_server.model import State, db


@app.route('/')
def hello():
    return 'HEPData Explore key-value storage'


@app.route('/states/<id>', methods=['GET'])
def get_state(id):
    state = State.query.get(id)
    return state.value


@app.route('/states/<id>', methods=['PUT'])
def put_state(id):
    # HEPData Explore states can get only so big
    if request.content_length > 10000:
        something_fishy('Request too long.')
    value = request.get_data(as_text=True)

    # Only JSON is allowed (don't try to upload HTML pages, please)
    try:
        json.loads(value)
    except ValueError:
        something_fishy('Invalid JSON.')

    # The id must match the content on a hash function
    if custom_url_hash(value) != id:
        something_fishy('Invalid id.')

    # OK, everything fine so far, let's try saving
    try:
        state = State(url_string_to_number(id), value, request.remote_addr,
                      datetime.now())
        db.session.add(state)
        db.session.commit()
        return Response(status=201)  # OK
    except IntegrityError:
        # The key already exists.
        db.session.rollback()
        return Response(status=204) # No Content


@app.teardown_request
def teardown_request(exception):
    """Needed so SQLAlchemy sessions are tear down after exceptions."""
    if exception:
        db.session.rollback()
        db.session.remove()
    db.session.remove()


