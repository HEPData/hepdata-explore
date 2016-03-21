#!/bin/bash
chmod -R o+rX .
exec rsync -Ppr ./ ntrrgc@rufian.eu:/home/ntrrgc/hepdata-explore/
