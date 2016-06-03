#!/bin/bash
set -eu
chmod -R o+rX .
pushd frontend
gulp
popd
rsync -Ppr \
  --exclude deployment \
  --exclude node_modules \
  ./ ntrrgc@hepdata.rufian.eu:/hepdata/hepdata-explore/
