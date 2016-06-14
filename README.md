# HEPData Explore

HEPData Explore is a data retrieval and visualization tool for high energy physics.

Data tables from scholarly publishing recorded in [HEPData.net](http://hepdata.net) are fed into an index that makes it possible to retrieve subsets according to user defined criteria and visualize them in the application.

HEPData Explore can put together several tables in a same plot -- even if they belong to different publications, as long as they share a pair of variables.

![Screenshot](http://i.imgur.com/JPApPJa.png)

## Links

* [HEPData Explore application](http://hepdata.rufian.eu/)
* [New HEPData site](https://hepdata.net/)
* User guide (soon)

## How to run (for developers)

You need Python3.3+, node.js, a Bash shell, and an installation of ElasticSearch. In order to make HEPData Explore work you need to set up the following components:

### ElasticSearch

An ElasticSearch must be running in port localhost, port 9200, unless otherwise set in `frontend/app/config.ts`.

### Downloading the data sets

Use the script provided in this repository to download the full data sets from HEPData archives:

https://github.com/HEPData/hepdata-retriever

### Data aggregator

The directory ``server-aggregator`` contains the application to load data into the index. Use the provided ``requirements.txt`` to install its dependencies, e.g:

    pip install -r requirements.txt

[Using a virtualenv](http://docs.python-guide.org/en/latest/dev/virtualenvs/) is highly recommended.

In addition to the data sets downloaded with the previous tool, in order to fetch the `publication.json` files needed to index some fields (e.g. collaboration, publication title), you must run the provided `download_publication_metadata.py` script, passing it the **directory** of the data files, e.g:

    python download_publication_metadata.py /hepdata/data

This only needs to be run once, even between reindex operations.

In order to index publications, use the `run_aggregator.py` launcher with the `add` command, passing it a list of publication directories that need to be added or updated. In order to index all of them you can use shell glob:

    python run_aggregator.py add /hepdata/data/*/*

### The kv-server

The key-value server is used to persist application states, allowing users to save and share their work.

In order to run it, install its requirements and run:

    python kv-server/kv-server.py run-server --db-url sqlite:////hepdata/kv-server.db \
     --enable-cors --host 0.0.0.0

*Note:* CORS is only needed in development, in order to have the application work from a port instead of requiring a proxy server like nginx. CORS should not be enabled in production for this application.

### The frontend application

The `frontend` directory contains the source code of the user interface, developed in TypeScript. In order to build it run the following commands:

    # Install the dependencies (including the TypeScript compiler)
    npm install
    node_modules/typescript/bin/tsc

A development server with remote reload is included, run it with the following command:

    node ./browsersync.js

Automatically a new port should be assigned automatically to the application and the browser will open the page.

You can use the provided `browsersync-reload.sh` script as a task in your code editor to reload the browser after compilation is complete, e.g:

    node_modules/typescript/bin/tsc && ./browsersync-reload.sh

### Foreman

Optionally, once you have set up everything, you can use [foreman](https://ddollar.github.io/foreman/) to start all the dependencies in parallel the next time with a single command.

    foreman start

 See the bundled [Procfile](Procfile) as an example.

## About the project

HEPData Explore is being developed by [Juan Luis Boya García](http://ntrrgc.me/) at [University of Salamanca](http://www.usal.es/) in collaboration with [CERN](http://home.cern/).

This project is supervised by the [HEPData team](https://hepdata.net/about).
