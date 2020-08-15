#!/usr/bin/env bash
set -eu

url="https://download.geofabrik.de/europe/netherlands-latest.osm.pbf"
pbf_file=$(basename $url)
if [ ! -f "$pbf_file" ]; then
    echo "$url"
    curl "$url" -o "$pbf_file"
fi
ogr2ogr -f GeoJSON toilets.json $pbf_file -sql "select * from points where other_tags LIKE '%\"amenity\"=>\"toilets\"%'" -spat 6.530049 53.207292 6.584652 53.238109 -t_srs EPSG:3857
