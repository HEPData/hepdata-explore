elastic: /hepdata/elastic/elasticsearch-2.2.0/bin/elasticsearch
kv-server: ~/.virtualenvs/kv-server/bin/python kv-server/kv-server.py run-server --enable-cors --db-url sqlite:////hepdata/kv-server.db --host 0.0.0.0
browser-sync: ~/.virtualenvs/kv-server/bin/python wait-port.py 9200 && cd frontend && node ./browsersync.js
