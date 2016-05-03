import hashlib
import json
from datetime import datetime

import struct
from flask import Flask, request, jsonify, Response
from kv_server.model import db, State

app = Flask(__name__)


class HTTPError(Exception):
    def __init__(self, status_code, message):
        Exception.__init__(self)
        self.message = message
        self.status_code = status_code


def something_fishy(reason):
    ip = request.remote_addr
    cropped_body = request.get_data(as_text=True)[:200]
    app.logger.warn('A fishy request came from %s: %s' % (ip, reason))
    app.logger.warn('Request content: %s' % cropped_body)
    raise HTTPError(400, 'Bad request')


@app.errorhandler(HTTPError)
def handle_http_error(error):
    """
    :type error: HTTPErroauoe
    """
    response = jsonify({
        'message': error.message,
        'status_code': error.status_code,
    })
    """:type: Response"""
    response.status_code = error.status_code
    return response


@app.route('/')
def hello():
    handle_http_error("Hi")
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
    # TODO

    # OK, everything fine so far, let's save
    state = State(id, value, request.remote_addr, datetime.now())
    db.session.add(state)
    db.session.commit()

    return Response(status=201)  # OK


url_chars = '123456789abcdefghkmnpqrstuvwxyzABCDEFGHKMNPQRSTUVWXYZ'
len_url_string = 5
url_number_modulo = len(url_chars) ** len_url_string


def number_to_url_string(number):
    assert(number < url_number_modulo)
    output = ''
    for i in range(len_url_string):
        output = url_chars[number % len(url_chars)] + output
        number = number // len(url_chars)
    return output


def url_string_to_number(url_string):
    number = 0
    for i, char in enumerate(reversed(url_string)):
        number += url_chars.index(char) * len(url_chars) ** i
    return number


def hash_to_url_number(string):
    suffix = string[-4:]  # last four bytes
    return struct.unpack('>L', suffix)[0] % url_number_modulo


def hash_string(a_string):
    m = hashlib.sha224()
    m.update(a_string.encode('UTF-8'))
    return m.digest()


def custom_url_hash(input):
    return number_to_url_string(hash_to_url_number(hash_string(input)))
