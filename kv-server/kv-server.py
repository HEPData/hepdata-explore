import argh


def create_db():
    from kv_server.model import db
    db.create_all()


def run_server(host='localhost', port=9201, debug=False):
    from kv_server.app import app

    # looks unused, but it's actually needed in order to have... well, views.
    import kv_server.views

    if debug:
        # Auto reloads (sort of), but hangs easily :(
        app.run(host, port, debug)
    else:
        # Tornado is needed in order not to get hung on browser connections
        from tornado.wsgi import WSGIContainer
        from tornado.httpserver import HTTPServer
        from tornado.ioloop import IOLoop

        http_server = HTTPServer(WSGIContainer(app))
        http_server.listen(port, address=host)
        IOLoop.instance().start()


argh.dispatch_commands([
    create_db,
    run_server
])
