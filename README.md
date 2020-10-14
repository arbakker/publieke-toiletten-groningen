# Webmap van publieke toiletten in Groningen

Requires [`npm`](https://www.npmjs.com/).

To install the dependencies and run in debug mode:

```
npm install
npm start
```

## Clean up GeoJSON attributes

Rename attributes with jq:

```
cat toilets.json | jq '.features[].properties |= with_entries(if .key == "wheelchair" then .key = "accessibility" else . end)' | jq ".features[].properties.accessibility_plus = false" > toilets2.json
```

Delete multiple attributes with jq:

```
cat buffer_250.json| jq ".features[].properties |= del(.path)" | jq ".features[].properties |= del(.area)" | jq ".features[].properties |= del(.perimeter)" | jq ".features[].properties |= del(.layer)" > buffer_250_2.json && mv buffer_250_2.json buffer_250.json
cat buffer_500.json| jq ".features[].properties |= del(.path)" | jq ".features[].properties |= del(.area)" | jq ".features[].properties |= del(.perimeter)" | jq ".features[].properties |= del(.layer)" > buffer_500_2.json && mv buffer_500_2.json buffer_500.json
```
