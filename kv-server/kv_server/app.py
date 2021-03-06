from flask import Flask, request, jsonify, Response


app = Flask(__name__)
app.config['PRESERVE_CONTEXT_ON_EXCEPTION'] = False
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PRESERVE_CONTEXT_ON_EXCEPTION'] = False


class HTTPError(Exception):
    def __init__(self, status_code, message):
        Exception.__init__(self)
        self.message = message
        self.status_code = status_code


def something_fishy(reason):
    ip = request.remote_addr
    cropped_body = request.get_data(as_text=True)[:200]
    app.logger.warn('A fishy request came from %s at %s %s: %s' %
                    (ip, request.method, request.path, reason))
    if cropped_body:
        app.logger.warn('Request content: %s' % cropped_body)
    raise HTTPError(400, 'Bad request')


@app.errorhandler(HTTPError)
def handle_http_error(error):
    """
    :type error: HTTPError
    """
    response = jsonify({
        'message': error.message,
        'status_code': error.status_code,
    })
    """:type: Response"""
    response.status_code = error.status_code
    return response


