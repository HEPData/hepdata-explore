import argh


def create_db():
    from kv_server.model import db
    db.create_all()


def run_server(host='0.0.0.0', port=10020, debug=False):
    from kv_server.app import app
    app.run(host, port, debug)


argh.dispatch_commands([
    create_db,
    run_server
])
