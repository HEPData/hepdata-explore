#!/bin/bash
chmod -R o+r .
exec rsync -Ppr ./frontend/ ntrrgc@rufian.eu:/srv/www/ntrrgc.rufian.eu/hepdata-explore/
