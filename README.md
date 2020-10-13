# Webmap van publieke toiletten in Groningen

Requires [`npm`](https://www.npmjs.com/).

To install the dependencies and run in debug mode:

```
npm install
npm start
```

## Clean up GeoJSON attributes

Neat way to remove attributes with jq from a GeoJSON file:

```
cat input.json | jq ".features[].properties |= del(.area)"
```

So for instance remove multiple fields:

```
cat buffer_250.json| jq ".features[].properties |= del(.path)" | jq ".features[].properties |= del(.area)" | jq ".features[].properties |= del(.perimeter)" | jq ".features[].properties |= del(.latlong)" | jq ".features[].properties |= del(.acces_stre)"
```
