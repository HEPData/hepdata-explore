const prod = location.hostname.indexOf('.rufian.eu') != -1;

const elasticIndex = 'hepdata6';

export const config = {
    // Used for search
    elasticUrl: (prod 
        ? '/elastic'
        : 'http://' + location.hostname + ':9200'
    ) + '/' + elasticIndex,

    // Used for state persistence
    kvServerUrl: (prod
        ? '/kv-server'
        : 'http://' + location.hostname + ':9201'
    ),
};