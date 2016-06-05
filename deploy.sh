#!/bin/bash
set -eu
chmod -R o+rX .
pushd frontend
gulp
popd
rsync -Ppr \
  --exclude deployment \
  --exclude node_modules \
  ./ root@hepdata.rufian.eu:/hepdata/hepdata-explore/
