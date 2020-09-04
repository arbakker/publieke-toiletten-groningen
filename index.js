import 'ol/ol.css'
import { Map, View } from 'ol'
import WMTSSource from 'ol/source/WMTS'
import TileLayer from 'ol/layer/Tile.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'
import { fromLonLat } from 'ol/proj'
import GeoJSON from 'ol/format/GeoJSON';
import { getTopLeft, getWidth } from 'ol/extent.js'
import 'ol-layerswitcher/src/ol-layerswitcher.css'
import { get as getProjection } from 'ol/proj'
import { Fill, RegularShape, Stroke, Style } from 'ol/style';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import toilets from './toilets.json'
import { Control, defaults as defaultControls } from 'ol/control';
import { toContext } from 'ol/render';
import { Point } from 'ol/geom';
import Overlay from 'ol/Overlay';

const BRTA_ATTRIBUTION = 'Data publieke toiletten bewerkt voor test doeleinden (niet waarheidsgetrouw) <a href="http://openstreetmap.org">OpenStreetMap</a>, Achtergrondkaart: © <a href="http://www.cbs.nl">CBS</a>, <a href="http://www.kadaster.nl">Kadaster</a>, <a href="http://openstreetmap.org">OpenStreetMap</a><span class="printhide">-auteurs (<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>).</span>'

var projection = getProjection('EPSG:3857');
var projectionExtent = projection.getExtent();

var resolutions = new Array(14);
var matrixIds = new Array(14);
var size = getWidth(projectionExtent) / 256;

for (var z = 0; z < 18; ++z) {
    // generate resolutions and matrixIds arrays for this WMTS
    resolutions[z] = size / Math.pow(2, z);
    matrixIds[z] = z;
}

function getWmtsLayer(layername) {
    return new TileLayer({
        type: 'base',
        title: `${layername} WMTS`,
        extent: projectionExtent,
        source: new WMTSSource({
            url: 'https://geodata.nationaalgeoregister.nl/tiles/service/wmts',
            layer: layername,
            matrixSet: 'EPSG:3857',
            format: 'image/png',
            attributions: BRTA_ATTRIBUTION,
            tileGrid: new WMTSTileGrid({
                origin: getTopLeft(projectionExtent),
                resolutions: resolutions,
                matrixIds: matrixIds,
            }),
            style: 'default'
        })
    })
}

var vectorSource = new VectorSource({
    features: new GeoJSON().readFeatures(toilets),
})

var strokeClosed = new Stroke({ color: 'gray', width: 2 });
var strokeOpen = new Stroke({ color: 'green', width: 2 });

var fill = new Fill({ color: 'red' });
var vectorLayer = new VectorLayer({
    source: vectorSource,
    style: new Style({
        image: new RegularShape({
            fill: fill,
            stroke: strokeOpen,
            points: 4,
            radius: 10,
            radius2: 0,
            angle: Math.PI / 4,
        })
    })
})


const brtGrijsWmtsLayer = getWmtsLayer('brtachtergrondkaartgrijs')


function timeStampToFloat(timeStamp) {
    let hours = parseFloat(timeStamp.split(":")[0])
    let minutes = parseFloat(timeStamp.split(":")[1])
    let fraction = minutes / 60.0
    let result = fraction + hours
    return result
}

function getHoursFromMidnight(time, previous = "") {
    if (!previous) {
        return timeStampToFloat(time)
    } else {
        let timeUntil = timeStampToFloat(time)
        let timeFrom = timeStampToFloat(previous)

        if (timeUntil < timeFrom) {
            timeUntil += 24
            return timeUntil
        } else {
            return timeStampToFloat(time)
        }
    }
}

function toiletOpen(feature, time) {
    let hoursFMFrom = getHoursFromMidnight(feature.getProperties()["open_from"])
    let hoursFMUntil = getHoursFromMidnight(feature.getProperties()["open_until"], feature.getProperties()["open_from"])
    let hoursFMCurrent = getHoursFromMidnight(time)
    if (hoursFMCurrent >= hoursFMFrom && hoursFMCurrent <= hoursFMUntil) {
        return true
    }
    // in case the time range passes midnight e.g: 23:00 - 05:00
    if (hoursFMUntil > 24) {
        hoursFMCurrent += 24
        if (hoursFMCurrent >= hoursFMFrom && hoursFMCurrent <= hoursFMUntil) {
            return true
        }
    }
    return false
}


var openStyle = new Style({
    image: new RegularShape({
        fill: fill,
        stroke: strokeOpen,
        points: 4,
        radius: 10,
        radius2: 0,
        angle: Math.PI / 4,
    })
})

var closedStyle = new Style({
    image: new RegularShape({
        fill: fill,
        stroke: strokeClosed,
        points: 4,
        radius: 10,
        radius2: 0,
        angle: Math.PI / 4,
    })
})


function isFeatureIncludedInFilters(feature) {
    let filterResult = []

    if (filterUrinal()) {
        let featureVal = feature.getProperties()["urinal_only"]
        filterResult.push(filterUrinalValue() === featureVal)
    }
    if (filterFee()) {
        let featureVal = feature.getProperties()["fee"]
        filterResult.push(filterFeeValue() === featureVal)
    }
    if (filterAccesable()) {
        let featureVal = feature.getProperties()["wheelchair"]
        filterResult.push(filterAccesableValue() === featureVal)
    }
   
    return filterResult.every(function(i) { return i; })
}

function filterFee() {
    return document.getElementById("feeCheckbox").checked
}
function filterFeeValue() {
    return document.getElementById("feeToggle").checked
}

function filterAccesable() {
    return document.getElementById("accesableCheckbox").checked
}
function filterAccesableValue() {
    return document.getElementById("accesableToggle").checked
}

function filterUrinal() {
    return document.getElementById("urinalCheckbox").checked
}
function filterUrinalValue() {
    return document.getElementById("urinalToggle").checked
}


function changeStyleToilets(time) {

    vectorLayer.setStyle(function (feature, resolution) {
        if (isFeatureIncludedInFilters(feature)) {
            let open = toiletOpen(feature, time)
            if (open) {
                return openStyle
            } else {
                return closedStyle
            }
        }
    })
}

function getTimeStamp(sliderValue) {
    let hours = Math.floor(sliderValue / 60).toString().padStart(2, '0');
    let minutes = (sliderValue % 60).toString().padStart(2, '0');
    if (hours == '24') {
        hours = '00'
    }
    return `${hours}:${minutes}`
}

function updateStyle() {
    let slider = document.getElementById("timeSlider")
    let label = document.getElementById("timeLabel")

    let timeString = getTimeStamp(slider.value)
    label.innerHTML = `tijdstip ${timeString}`
    changeStyleToilets(timeString)
}




var TimeSliderControl = /*@__PURE__*/ (function (Control) {
    function TimeSliderControl(opt_options) {
        var options = opt_options || {};


        let slider = document.createElement('input')
        slider.setAttribute('type', 'range')
        slider.setAttribute('min', '1')
        slider.setAttribute('max', '1440')
        slider.setAttribute('value', '500')
        slider.setAttribute('class', 'slider')
        slider.setAttribute('id', 'timeSlider')

        let label = document.createElement("div")
        label.setAttribute('id', 'timeLabel')


        slider.addEventListener('change', function (e) {
            updateStyle()
        })
        label.innerHTML = `tijdstip ${getTimeStamp(slider.value)}`

        let element = document.createElement('div');
        element.className = 'time-slider ol-unselectable ol-control';
        element.appendChild(slider)
        element.appendChild(label)

        Control.call(this, {
            element: element,
            target: options.target,
        });
    }

    if (Control) TimeSliderControl.__proto__ = Control;
    TimeSliderControl.prototype = Object.create(Control && Control.prototype);
    TimeSliderControl.prototype.constructor = TimeSliderControl;

    TimeSliderControl.prototype.handleRotateNorth = function handleRotateNorth() {
        this.getMap().getView().setRotation(0);
    };

    return TimeSliderControl;
}(Control));


var FilterControl = /*@__PURE__*/ (function (Control) {
    function FilterControl(opt_options) {
        var options = opt_options || {};


        let container = document.createElement('div')
        let urinalDiv = document.createElement('div')
        urinalDiv.setAttribute('id', 'urinalFilter')
        let accessableDiv = document.createElement('div')
        accessableDiv.setAttribute('id', 'accesableFilter')
        let feeDiv = document.createElement('div')
        feeDiv.setAttribute('id', 'feeFilter')

        let urinalCheckbox = document.createElement('input')
        let accesableCheckbox = document.createElement('input')
        let feeCheckbox = document.createElement('input')

        urinalCheckbox.setAttribute('id', 'urinalCheckbox')
        accesableCheckbox.setAttribute('id', 'accesableCheckbox')
        feeCheckbox.setAttribute('id', 'feeCheckbox')
        urinalCheckbox.setAttribute('name', 'urinoir')
        accesableCheckbox.setAttribute('name', 'toegankelijkheid')
        feeCheckbox.setAttribute('name', 'betaald')

        urinalCheckbox.setAttribute('type', 'checkbox')
        accesableCheckbox.setAttribute('type', 'checkbox')
        feeCheckbox.setAttribute('type', 'checkbox')

        let urinalLabel = document.createElement('label')
        let accesableLabel = document.createElement('label')
        let feeLabel = document.createElement('label')
        urinalLabel.setAttribute("for", "urinoir")
        accesableLabel.setAttribute("for", "toegankelijkheid")
        feeLabel.setAttribute("for", "betaald")
        urinalLabel.innerText = "alleen urinoir"
        accesableLabel.innerText = "rolstoel toegankelijk"
        feeLabel.innerText = "betaald"

        // create toggle urinal
        let urinalToggleLabel = document.createElement('label')
        urinalToggleLabel.classList.add("switch")
        let urinalToggleCheckbox = document.createElement('input')
        urinalToggleCheckbox.setAttribute("id", "urinalToggle")
        urinalToggleCheckbox.setAttribute("type", "checkbox")
        urinalToggleCheckbox.setAttribute("checked", null)
        let urinalTogglespan = document.createElement('span')
        urinalTogglespan.classList.add("slider", "round")
        urinalToggleLabel.appendChild(urinalToggleCheckbox)
        urinalToggleLabel.appendChild(urinalTogglespan)

        // create toggle fee
        let feeToggleLabel = document.createElement('label')
        feeToggleLabel.classList.add("switch")
        let feeToggleCheckbox = document.createElement('input')
        feeToggleCheckbox.setAttribute("id", "feeToggle")
        feeToggleCheckbox.setAttribute("type", "checkbox")
        feeToggleCheckbox.setAttribute("checked", null)
        let feeTogglespan = document.createElement('span')
        feeTogglespan.classList.add("slider", "round")
        feeToggleLabel.appendChild(feeToggleCheckbox)
        feeToggleLabel.appendChild(feeTogglespan)

        // create accesable fee
        let accesableToggleLabel = document.createElement('label')
        accesableToggleLabel.classList.add("switch")
        let accesableToggleCheckbox = document.createElement('input')
        accesableToggleCheckbox.setAttribute("id", "accesableToggle")
        accesableToggleCheckbox.setAttribute("type", "checkbox")
        accesableToggleCheckbox.setAttribute("checked", null)
        let accesableTogglespan = document.createElement('span')
        accesableTogglespan.classList.add("slider", "round")
        accesableToggleLabel.appendChild(accesableToggleCheckbox)
        accesableToggleLabel.appendChild(accesableTogglespan)

        urinalDiv.append(urinalCheckbox)
        urinalDiv.append(urinalLabel)
        urinalDiv.append(urinalToggleLabel)

        accessableDiv.append(accesableCheckbox)
        accessableDiv.append(accesableLabel)
        accessableDiv.append(accesableToggleLabel)

        feeDiv.append(feeCheckbox)
        feeDiv.append(feeLabel)
        feeDiv.append(feeToggleLabel)

        container.appendChild(urinalDiv)
        container.appendChild(accessableDiv)
        container.appendChild(feeDiv)

        let element = document.createElement('div');
        element.className = 'filter ol-unselectable ol-control';
        element.appendChild(container)

        let body = document.getElementsByTagName('body')[0]
        body.addEventListener('click', event => {
            if (event.target !== feeCheckbox && event.target !== accesableCheckbox && event.target !== urinalCheckbox
                && event.target !== urinalToggleCheckbox && event.target !== feeToggleCheckbox && event.target !== accesableToggleCheckbox) {
                return
            }
            //handle click
            updateStyle()
        })


        Control.call(this, {
            element: element,
            target: options.target,
        });
    }

    if (Control) FilterControl.__proto__ = Control;
    FilterControl.prototype = Object.create(Control && Control.prototype);
    FilterControl.prototype.constructor = FilterControl;

    FilterControl.prototype.handleRotateNorth = function handleRotateNorth() {
        this.getMap().getView().setRotation(0);
    };

    return FilterControl;
}(Control));




var LegendControl = /*@__PURE__*/ (function (Control) {
    function LegendControl(opt_options) {
        var options = opt_options || {};
        let canvas = document.createElement("CANVAS");
        canvas.setAttribute('id', 'canvas')

        let element = document.createElement('div');
        element.className = 'legend ol-unselectable ol-control';
        element.appendChild(canvas)

        Control.call(this, {
            element: element,
            target: options.target,
        });
    }

    if (Control) LegendControl.__proto__ = Control;
    LegendControl.prototype = Object.create(Control && Control.prototype);
    LegendControl.prototype.constructor = LegendControl;

    LegendControl.prototype.handleRotateNorth = function handleRotateNorth() {
        this.getMap().getView().setRotation(0);
    };

    return LegendControl;
}(Control));


/**
 * Elements that make up the popup.
 */
var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var closer = document.getElementById('popup-closer');

/**
 * Add a click handler to hide the popup.
 * @return {boolean} Don't follow the href.
 */
closer.onclick = function () {
    overlay.setPosition(undefined);
    closer.blur();
    return false;
};

/**
 * Create an overlay to anchor the popup to the map.
 */
const overlay = new Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: {
        duration: 250,
    },
});

const map = new Map({
    controls: defaultControls().extend([new TimeSliderControl(), new LegendControl(), new FilterControl()]),
    layers: [
        brtGrijsWmtsLayer,
        vectorLayer
    ],
    target: 'map',
    overlays: [overlay],
    view: new View({
        center: fromLonLat([6.569695, 53.211223]),
        zoom: 13
    })
})

const generateLegend = features => {
    const vals = [true, false]
    const canvas = document.getElementById('canvas');
    const canvasContext = canvas.getContext('2d')
    var vectorContext = toContext(canvasContext, {
        size: [180, 100]
    });
    let i = 1
    canvasContext.font = "bold 16px Arial";
    canvasContext.fillText("Publieke Toiletten in", 0, 20);
    canvasContext.fillText("Groningen", 0, 40);

    vals
        .forEach(val => {
            let newStyle
            let label
            if (val) {
                newStyle = openStyle
                label = "Open"
            } else {
                newStyle = closedStyle
                label = "Gesloten"
            }



            vectorContext.setStyle(newStyle);
            vectorContext.drawGeometry(new Point([10, 50 + (30 * (i - 1))]));
            canvasContext.font = "16px Arial";
            canvasContext.fillText(label, 35, 70 + (35 * (i - 1)));
            i += 1
        });
};

generateLegend(vectorSource.getFeatures());


function genTableFromKVPs(kvps) {
    var table = document.createElement('table');
    Object.keys(kvps).forEach(function (key, index) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        var td2 = document.createElement('td');
        td1.innerText = key
        td2.innerText = kvps[key]
        tr.appendChild(td1)
        tr.appendChild(td2)
        table.appendChild(tr)
    })
    return table
}

map.on('singleclick', function (evt) {
    content.innerHTML = ""
    var coordinate = evt.coordinate;
    let ftAtPixel = false
    map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
        let props = feature.getProperties()
        delete props.geometry
        const table = genTableFromKVPs(props)
        content.appendChild(table)
        ftAtPixel = true
    })
    // content.innerHTML = '<p>You clicked here:</p><code>' + hdms + '</code>';
    if (ftAtPixel) {
        overlay.setPosition(coordinate);
    } else {
        overlay.setPosition(undefined);
        closer.blur();
    }
});

updateStyle()