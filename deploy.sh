#!/bin/bash
set -eu
chmod -R o+rX .
pushd frontend
gulp
popd
rsync -Ppr ./ ntrrgc@rufian.eu:/hepdata/hepdata-explore/
ssh -T ntrrgc@rufian.eu <<\HERE
sed -i 's|data-main="build/bootstrap"|data-main="release/bootstrap"|' /hepdata/hepdata-explore/frontend/index.html
HERE