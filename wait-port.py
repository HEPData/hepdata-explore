#!/usr/bin/env python3

import socket
import time
import argh


@argh.arg('port', type=int)
def wait_port(port):
    s = socket.socket()
    while True:
        try:
            s.connect(('localhost', port))
            break
        except ConnectionRefusedError:
            time.sleep(0.1)


if __name__ == '__main__':
    argh.dispatch_command(wait_port)
