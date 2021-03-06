import argh

default_db_url = 'sqlite:////tmp/kv-server.db'


def warn_default_db(db_url):
    if db_url == default_db_url:
        print('WARNING: You have not set a database URL with --db-url. '
              'The default database is written in /tmp and therefore may be '
              'deleted every boot. This is only suitable for debugging.')


def create_db(db_url=default_db_url):
    from kv_server.app import app
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    warn_default_db(db_url)

    from kv_server.model import db
    db.create_all()


def run_server(host='localhost', port=9201, debug=False, db_url=default_db_url,
               enable_cors=False):
    from kv_server.app import app
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    warn_default_db(db_url)

    # Decode client IP from X-Forwarded-For (nginx must be used in production,
    # configured to send this header)
    from werkzeug.contrib.fixers import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app)

    # On production CORS is not needed as kv-server lives in a proxy under
    # /kv-server
    if enable_cors:
        from flask.ext.cors import CORS
        CORS(app, resources={
            '*': {
                'origins': '*'
            }
        })

    # Create the database if it does not exist already
    from kv_server.model import db
    db.create_all()

    # looks unused, but it's actually needed in order to have... well, views.
    import kv_server.views

    if debug:
        # Auto reloads (sort of), but hangs easily :(
        app.run(host, port, debug)
    else:
        # gevent is needed in order not to get hung on browser connections
        from gevent.wsgi import WSGIServer

        http_server = WSGIServer((host, port), app)
        http_server.serve_forever()


argh.dispatch_commands([
    create_db,
    run_server
])
