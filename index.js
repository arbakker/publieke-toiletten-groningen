import 'ol/ol.css'
import { Map, View } from 'ol'
import WMTSSource from 'ol/source/WMTS'
import TileLayer from 'ol/layer/Tile.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'
import { fromLonLat } from 'ol/proj'
import GeoJSON from 'ol/format/GeoJSON';
import { getTopLeft, getWidth } from 'ol/extent.js'
import 'ol-layerswitcher/src/ol-layerswitcher.css'
import {get as getProjection } from 'ol/proj'
import { Fill, RegularShape, Stroke, Style } from 'ol/style';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import toilets from './toilets.json'
import { Control, defaults as defaultControls } from 'ol/control';
import { toContext } from 'ol/render';
import { Point } from 'ol/geom';

const BRTA_ATTRIBUTION = 'Kaartgegevens: © <a href="http://www.cbs.nl">CBS</a>, <a href="http://www.kadaster.nl">Kadaster</a>, <a href="http://openstreetmap.org">OpenStreetMap</a><span class="printhide">-auteurs (<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>).</span>'

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


function changeStyleToilets(time) {

    vectorLayer.setStyle(function(feature, resolution) {
        let open = toiletOpen(feature, time)

        if (open) {
            return openStyle
        } else {
            return closedStyle
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

var TimeSliderControl = /*@__PURE__*/ (function(Control) {
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


        slider.addEventListener('change', function(e) {
            let timeString = getTimeStamp(slider.value)
            label.innerHTML = `tijdstip ${timeString}`
            changeStyleToilets(timeString)
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





var LegendControl = /*@__PURE__*/ (function(Control) {
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

const map = new Map({
    controls: defaultControls().extend([new TimeSliderControl(), new LegendControl()]),
    layers: [
        brtGrijsWmtsLayer,
        vectorLayer
    ],
    target: 'map',
    view: new View({
        center: fromLonLat([6.569695, 53.211223]),
        zoom: 13
    })
})

const generateLegend = features => {
    const vals = [true, false]
    const canvas = document.getElementById('canvas');
    console.log(canvas)
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