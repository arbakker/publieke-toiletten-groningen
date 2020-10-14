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
import { Control, defaults as defaultControls } from 'ol/control';
import { toContext } from 'ol/render';
import { Point } from 'ol/geom';
import Overlay from 'ol/Overlay';
import toilets from './toilets.json'
import buffer250 from './buffer_250.json'
import buffer500 from './buffer_500.json'
import werkgebied from './werkgebied.json'
import Select from 'ol/interaction/Select';

import { isTypeUnique } from 'ol/style/expressions'


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
            attributions: " ",
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

var vectorSourceB250 = new VectorSource({
    features: new GeoJSON().readFeatures(buffer250),
})

var vectorSourceWerkgebied = new VectorSource({
    features: new GeoJSON().readFeatures(werkgebied),
})

var vectorSourceB500 = new VectorSource({
    features: new GeoJSON().readFeatures(buffer500),
})


var strokeClosed = new Stroke({ color: 'rgb(128, 128, 128)', width: 2 });
var fillClosed = new Fill({ color: 'rgba(128, 128, 128, 0.7)' })

var strokeOpen = new Stroke({ color: 'rgb(243,110,33)', width: 2 });
var fillOpen = new Fill({ color: 'rgba(243,110,33, 0.7)' })

var strokeSelected = new Stroke({ color: 'rgb(246, 255, 10)', width: 2 });
var fillSelected = new Fill({ color: 'rgba(246, 255, 10, 0.7)' })



var fill = new Fill({ color: 'red' });
var vectorLayer = new VectorLayer({
    source: vectorSource,
    style: new Style({
        image: new RegularShape({
            fill: fill,
            stroke: strokeOpen,
            points: 4,
            radius: 10,
            angle: Math.PI / 4,
        })
    })
})
var styleB250 = new Style({
    // rgb(28, 126, 201) rgba(33, 150, 243, 0.2)
    fill: new Fill({ color: 'rgba(28, 126, 201, 0.2)' }),
    stroke: new Stroke({ color: 'rgba(255,255,255, 0.2)', width: 1 })
})



var vectorLayerB250 = new VectorLayer({
    source: vectorSourceB250,
    style: styleB250
})
var styleB500 = new Style({
    fill: new Fill({ color: 'rgb(130, 193, 242, 0.2)', }),
    stroke: new Stroke({ color: 'rgba(255,255,255, 0.2)', width: 1 })
});

var vectorLayerB500 = new VectorLayer({
    source: vectorSourceB500,
    style: styleB500
})

var vectorLayerWerkgebied = new VectorLayer({
    source: vectorSourceWerkgebied,
    style: new Style({
        stroke: new Stroke({ 
            color: 'rgba(0,0,0, 0.5)',
            width: 2,
            lineDash: [.1, 7]
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
    console.log(time)
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

function toiletOpen(feature, day, time) {
    let hoursDay = feature.getProperties()["openinghours"][day]
    let hoursFrom = hoursDay.split(" - ")[0]
    let hoursUntil = hoursDay.split(" - ")[1]

    let hoursFMFrom = getHoursFromMidnight(hoursFrom)
    let hoursFMUntil = getHoursFromMidnight(hoursUntil, hoursFrom)
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
        fill: fillOpen,
        stroke: strokeOpen,
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
    })
})

var closedStyle = new Style({
    image: new RegularShape({
        fill: fillClosed,
        stroke: strokeClosed,
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
    })
})

var selectedStyle = new Style({
    image: new RegularShape({
        fill: fillOpen,
        stroke: strokeOpen,
        points: 4,
        radius: 6,
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
        let featureVal = feature.getProperties()["accessibility"]
        filterResult.push(filterAccesableValue() === featureVal)
    }
    if (filterAccesablePlus()) {
        let featureVal = feature.getProperties()["accessibility_plus"]
        filterResult.push(filterAccesablePlusValue() === featureVal)
    }
    if (filterOwnership()) {
        let featureVal = feature.getProperties()["ownership"]
        filterResult.push(filterOwnershipValues().includes(featureVal))
    }

    return filterResult.every(function (i) { return i; })
}

function filterOwnership() {
    return document.getElementById("ownershipCheckbox").checked
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

function filterAccesablePlus() {
    return document.getElementById("accesable2Checkbox").checked
}
function filterAccesableValue() {
    return document.getElementById("accesableToggle").checked
}

function filterAccesablePlusValue() {
    return document.getElementById("accesable2Toggle").checked
}

function filterOwnershipValues() {
    let spans = document.querySelectorAll(".spanSelector");

    let selected = []
    for (let i = 0; i < spans.length; ++i) {
        let span = spans[i]
        if (span.classList.contains("selected")) {
            if (span.innerText === "publiek") {
                selected.push("public")
            } else if (span.innerText === "privaat") {
                selected.push("private")
            } else if (span.innerText === "gemeentelijk") {
                selected.push("municipal")
            }
        }
    }
    return selected
}

function filterUrinal() {
    return document.getElementById("urinalCheckbox").checked
}
function filterUrinalValue() {
    return document.getElementById("urinalToggle").checked
}


function changeStyleToilets(day, time) {
    vectorLayer.setStyle(function (feature, resolution) {
        if (isFeatureIncludedInFilters(feature)) {
            let checkbox = document.getElementById("timeCheckbox")
            if (!checkbox || !checkbox.checked) {
                return openStyle
            }
            let open = toiletOpen(feature, day, time)
            if (open) {
                return openStyle
            } else {
                return closedStyle
            }
        }
    })
}

function changeStyleB250(day, time) {
    vectorLayerB250.setStyle(function (feature, resolution) {
        if (isFeatureIncludedInFilters(feature)) {
            let checkbox = document.getElementById("timeCheckbox")
            if (!checkbox || !checkbox.checked) {
                return styleB250
            }
            let open = toiletOpen(feature, day, time)
            if (open) {
                return styleB250
            } else {
                return new Style({})
            }
        }
    })
}


function changeStyleB500(day, time) {
    vectorLayerB500.setStyle(function (feature, resolution) {
        if (isFeatureIncludedInFilters(feature)) {
            let checkbox = document.getElementById("timeCheckbox")
            if (!checkbox || !checkbox.checked) {
                return styleB500
            }
            let open = toiletOpen(feature, day, time)
            if (open) {
                return styleB500
            } else {
                return new Style({})
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

    let day = document.querySelector('input[name="radioDay"]:checked').value;
    changeStyleToilets(day, timeString)
    changeStyleB500(day, timeString)
    changeStyleB250(day, timeString)
}




var TimeSliderControl = /*@__PURE__*/ (function (Control) {
    function TimeSliderControl(opt_options) {
        var options = opt_options || {};
        let body = document.getElementsByTagName('body')[0]

        let timeCheckbox = document.createElement('input')
        timeCheckbox.classList.add("filterCheckbox")
        timeCheckbox.setAttribute('id', 'timeCheckbox')
        timeCheckbox.setAttribute('name', 'time')
        timeCheckbox.setAttribute("type", "checkbox")

        // see https://jsfiddle.net/pga592ry/
        const days = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
        let dayDiv = document.createElement("div")
        dayDiv.className = "radio-toolbar"
        let first = true
        days.forEach(function (day) {
            // <input type="radio" id="rMa" name="rDay" value="ma" checked>
            // <label for="rMa">ma</label>

            let rd = document.createElement('input')
            rd.setAttribute("type", "radio")
            rd.setAttribute("id", `${day}`)
            rd.setAttribute("name", "radioDay")
            rd.setAttribute("value", day)

            if (first) {
                rd.checked = true
                first = false
            }

            let rdLabel = document.createElement('label')
            rdLabel.innerText = day
            rdLabel.setAttribute("for", `${day}`)
            dayDiv.appendChild(rd)
            dayDiv.appendChild(rdLabel)
        });



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

        let firstDiv = document.createElement('div')
        firstDiv.className = "inline-parent"

        firstDiv.appendChild(timeCheckbox)
        firstDiv.appendChild(dayDiv)
        element.appendChild(firstDiv)
        element.appendChild(slider)
        element.appendChild(label)

        body.addEventListener('click', event => {
            if (event.target !== timeCheckbox && event.target.name !== "radioDay") {
                return
            }
            if (event.target.name === "radioDay" && !timeCheckbox.checked) { return }
            if (event.target === timeCheckbox) {
                let legend = document.querySelector(".legend.ol-control")
                event.target.checked ? legend.classList.remove("collapsed") : legend.classList.add("collapsed")
            }
            //handle click
            updateStyle()
        })


        Control.call(this, {
            element: element,
            target: options.target,
        });
    }

    if (Control) TimeSliderControl.__proto__ = Control;
    TimeSliderControl.prototype = Object.create(Control && Control.prototype);
    TimeSliderControl.prototype.constructor = TimeSliderControl;


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
        let accessable2Div = document.createElement('div')
        accessable2Div.setAttribute('id', 'accesableFilter2')
        let feeDiv = document.createElement('div')
        feeDiv.setAttribute('id', 'feeFilter')

        let ownershipDiv = document.createElement('div')
        ownershipDiv.setAttribute('id', 'ownership')

        let urinalCheckbox = document.createElement('input')
        let accesableCheckbox = document.createElement('input')
        let accesable2Checkbox = document.createElement('input')
        let feeCheckbox = document.createElement('input')
        let ownershipCheckbox = document.createElement('input')
        urinalCheckbox.classList.add("filterCheckbox")
        accesableCheckbox.classList.add("filterCheckbox")
        accesable2Checkbox.classList.add("filterCheckbox")
        feeCheckbox.classList.add("filterCheckbox")
        ownershipCheckbox.classList.add("filterCheckbox")


        urinalCheckbox.setAttribute('id', 'urinalCheckbox')
        accesableCheckbox.setAttribute('id', 'accesableCheckbox')
        feeCheckbox.setAttribute('id', 'feeCheckbox')
        accesable2Checkbox.setAttribute('id', 'accesable2Checkbox')
        ownershipCheckbox.setAttribute('id', 'ownershipCheckbox')
        urinalCheckbox.setAttribute('name', 'urinoir')
        accesableCheckbox.setAttribute('name', 'toegankelijkheid')
        accesable2Checkbox.setAttribute('name', 'toegankelijkheid-2')
        feeCheckbox.setAttribute('name', 'betaald')

        urinalCheckbox.setAttribute('type', 'checkbox')
        accesableCheckbox.setAttribute('type', 'checkbox')
        accesable2Checkbox.setAttribute('type', 'checkbox')
        feeCheckbox.setAttribute('type', 'checkbox')
        ownershipCheckbox.setAttribute('type', 'checkbox')

        let urinalLabel = document.createElement('label')
        let accesableLabel = document.createElement('label')
        let accesable2Label = document.createElement('label')
        let feeLabel = document.createElement('label')
        let ownershipLabel = document.createElement('label')

        urinalLabel.setAttribute("for", "urinoir")
        accesableLabel.setAttribute("for", "toegankelijkheid")
        accesable2Label.setAttribute("for", "toegankelijkheid-2")
        feeLabel.setAttribute("for", "betaald")
        ownershipLabel.setAttribute("for", "eigendom")
        urinalLabel.innerText = "alleen urinoir"
        accesableLabel.innerText = "rolstoeltoegankelijk -"
        accesable2Label.innerText = "rolstoeltoegankelijk"
        feeLabel.innerText = "betaald"
        ownershipLabel.innerText = "eigendom"

        // create eigendom selector
        let publiekSpan = document.createElement('span')
        publiekSpan.id = "publiekSpan"
        publiekSpan.innerText = "publiek"
        publiekSpan.classList.add("spanSelector")
        let privateSpan = document.createElement('span')
        privateSpan.id = "privateSpan"
        privateSpan.classList.add("spanSelector")
        privateSpan.innerText = "privaat"
        let streetSpan = document.createElement('span')
        streetSpan.id = "streetSpan"
        streetSpan.classList.add("spanSelector")
        streetSpan.classList.add("selected")
        
        streetSpan.innerText = "gemeentelijk"

        // create toggle urinal
        let urinalToggleLabel = document.createElement('label')
        urinalToggleLabel.classList.add("switch")
        let urinalToggleCheckbox = document.createElement('input')
        urinalToggleCheckbox.setAttribute("id", "urinalToggle")
        urinalToggleCheckbox.setAttribute("type", "checkbox")
        urinalToggleCheckbox.setAttribute("checked", null)
        let urinalTogglespan = document.createElement('span')
        urinalTogglespan.classList.add("slider-round")
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
        feeTogglespan.classList.add("slider-round")
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
        accesableTogglespan.classList.add("slider-round")
        accesableToggleLabel.appendChild(accesableToggleCheckbox)
        accesableToggleLabel.appendChild(accesableTogglespan)

        // create accesable2 fee
        let accesable2ToggleLabel = document.createElement('label')
        accesable2ToggleLabel.classList.add("switch")
        let accesable2ToggleCheckbox = document.createElement('input')
        accesable2ToggleCheckbox.setAttribute("id", "accesable2Toggle")
        accesable2ToggleCheckbox.setAttribute("type", "checkbox")
        accesable2ToggleCheckbox.setAttribute("checked", null)
        let accesable2Togglespan = document.createElement('span')
        accesable2Togglespan.classList.add("slider-round")
        accesable2ToggleLabel.appendChild(accesable2ToggleCheckbox)
        accesable2ToggleLabel.appendChild(accesable2Togglespan)

        ownershipDiv.append(ownershipCheckbox)
        ownershipDiv.append(ownershipLabel)
        ownershipDiv.append(streetSpan)
        ownershipDiv.append(publiekSpan)
        ownershipDiv.append(privateSpan)

        urinalDiv.append(urinalCheckbox)
        urinalDiv.append(urinalLabel)
        urinalDiv.append(urinalToggleLabel)

        accessableDiv.append(accesableCheckbox)
        accessableDiv.append(accesableLabel)
        accessableDiv.append(accesableToggleLabel)

        accessable2Div.append(accesable2Checkbox)
        accessable2Div.append(accesable2Label)
        accessable2Div.append(accesable2ToggleLabel)

        feeDiv.append(feeCheckbox)
        feeDiv.append(feeLabel)
        feeDiv.append(feeToggleLabel)

        container.appendChild(urinalDiv)
        container.appendChild(accessableDiv)
        container.appendChild(accessable2Div)
        container.appendChild(feeDiv)
        container.appendChild(ownershipDiv)


        let element = document.createElement('div');
        element.className = 'filter ol-unselectable ol-control';
        element.appendChild(container)

        let body = document.getElementsByTagName('body')[0]


        body.addEventListener('click', event => {
            if (event.target !== feeCheckbox && event.target !== accesableCheckbox && event.target !== accesable2Checkbox && event.target !== urinalCheckbox
                && event.target !== ownershipCheckbox && event.target !== urinalToggleCheckbox && event.target !== feeToggleCheckbox && event.target !== accesableToggleCheckbox
                && event.target !== accesable2ToggleCheckbox && event.target !== privateSpan && event.target !== streetSpan && event.target !== publiekSpan
            ) {
                return
            }
            if (event.target === privateSpan || event.target === streetSpan || event.target === publiekSpan) {
                if (event.target.classList.contains("selected")) {
                    event.target.classList.remove("selected")
                } else {
                    event.target.classList.add("selected")
                }
            }

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


    return FilterControl;
}(Control));


var LayerControl = /*@__PURE__*/ (function (Control) {
    function LayerControl(opt_options) {
        var options = opt_options || {};
        let container = document.createElement('div')

        container.setAttribute('id', 'layerFilter')


        let svcArea250Div = document.createElement('div')
        svcArea250Div.id = "svcArea250"

        let svcArea500Div = document.createElement('div')
        svcArea500Div.id = "svcArea500"

        let svcArea500Label = document.createElement('label500')
        let svcArea250Label = document.createElement('label250')

        svcArea500Label.setAttribute("for", "svcArea500")
        svcArea250Label.setAttribute("for", "svcArea250")


        svcArea500Label.innerText = "servicegebied 500m"
        svcArea250Label.innerText = "servicegebied 250m"

        // 250 m
        let svc250ToggleLabel = document.createElement('label')
        svc250ToggleLabel.classList.add("switch")
        let svc250ToggleCheckbox = document.createElement('input')
        svc250ToggleCheckbox.setAttribute("id", "svc250Toggle")
        svc250ToggleCheckbox.setAttribute("type", "checkbox")
        svc250ToggleCheckbox.setAttribute("checked", null)
        let svc250Togglespan = document.createElement('span')
        svc250Togglespan.classList.add("slider-round")
        svc250ToggleLabel.appendChild(svc250ToggleCheckbox)
        svc250ToggleLabel.appendChild(svc250Togglespan)

        svcArea250Div.append(svcArea250Label)
        svcArea250Div.append(svc250ToggleLabel)
        container.append(svcArea250Div)

        // 500 m 
        let svc500ToggleLabel = document.createElement('label')
        svc500ToggleLabel.classList.add("switch")
        let svc500ToggleCheckbox = document.createElement('input')
        svc500ToggleCheckbox.setAttribute("id", "svc250Toggle")
        svc500ToggleCheckbox.setAttribute("type", "checkbox")
        svc500ToggleCheckbox.setAttribute("checked", null)
        let svc500Togglespan = document.createElement('span')
        svc500Togglespan.classList.add("slider-round")
        svc500ToggleLabel.appendChild(svc500ToggleCheckbox)
        svc500ToggleLabel.appendChild(svc500Togglespan)

        svcArea500Div.append(svcArea500Label)
        svcArea500Div.append(svc500ToggleLabel)
        container.append(svcArea500Div)

        let element = document.createElement('div');
        element.className = 'layerfilter ol-unselectable ol-control';
        element.appendChild(container)

        let body = document.getElementsByTagName('body')[0]
        body.addEventListener('click', event => {
            if (event.target !== svc250ToggleCheckbox && event.target !== svc500ToggleCheckbox) {
                return
            }

            if (event.target === svc250ToggleCheckbox) {
                vectorLayerB250.setVisible(event.target.checked)
            }
            if (event.target === svc500ToggleCheckbox) {
                vectorLayerB500.setVisible(event.target.checked)
            }

        })


        Control.call(this, {
            element: element,
            target: options.target,
        });
    }

    if (Control) LayerControl.__proto__ = Control;
    LayerControl.prototype = Object.create(Control && Control.prototype);
    LayerControl.prototype.constructor = LayerControl;
    return LayerControl;
}(Control));



var LegendControl = /*@__PURE__*/ (function (Control) {
    function LegendControl(opt_options) {
        var options = opt_options || {};


        let element = document.createElement('div');
        let legend1 = document.createElement('div');
        let legend2 = document.createElement('div');
        legend1.classList.add("legendItem")
        legend2.classList.add("legendItem")
        let legendLabel1 = document.createElement('div')
        legendLabel1.classList.add("legendLabel")
        legendLabel1.innerText = "Open"

        let legendLabel2 = document.createElement('div')
        legendLabel2.classList.add("legendLabel")
        legendLabel2.innerText = "Gesloten"


        let canvas1 = document.createElement("CANVAS");
        canvas1.setAttribute('id', 'canvas1')

        let canvas2 = document.createElement("CANVAS");
        canvas2.setAttribute('id', 'canvas2')

        legend1.appendChild(canvas1)
        legend1.appendChild(legendLabel1)
        legend2.appendChild(canvas2)
        legend2.appendChild(legendLabel2)
        element.appendChild(legend1)
        element.appendChild(legend2)



        element.className = 'legend ol-unselectable ol-control collapsed';


        Control.call(this, {
            element: element,
            target: options.target,
        });
    }

    if (Control) LegendControl.__proto__ = Control;
    LegendControl.prototype = Object.create(Control && Control.prototype);
    LegendControl.prototype.constructor = LegendControl;


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
    select.getFeatures().clear()
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
    controls: defaultControls().extend([new TimeSliderControl(), new LegendControl(), new FilterControl(), new LayerControl()]),
    layers: [
        brtGrijsWmtsLayer,
        vectorLayerWerkgebied,
        vectorLayerB500,
        vectorLayerB250,
        vectorLayer
    ],
    target: 'map',
    overlays: [overlay],
    view: new View({
        center: fromLonLat([6.565695, 53.218]),
        zoom: 15,
        extent: [724881.0031,7019154.9797,736337.0027,7028098.1120]
    })
})

const generateLegend = features => {

    const canvas1 = document.getElementById('canvas1');
    const canvasContext1 = canvas1.getContext('2d')
    var vectorContext1 = toContext(canvasContext1, {
        size: [30, 30],
        pixelRatio: 1
    });

    vectorContext1.setStyle(openStyle);
    vectorContext1.drawGeometry(new Point([10, 10]));

    const canvas2 = document.getElementById('canvas2');
    const canvasContext2 = canvas2.getContext('2d')
    var vectorContext2 = toContext(canvasContext2, {
        size: [30, 30],
        pixelRatio: 1
    });
    vectorContext2.setStyle(closedStyle);
    vectorContext2.drawGeometry(new Point([10, 10]));


};

generateLegend(vectorSource.getFeatures());


function genTableFromKVPs(kvps) {
    const keyLookup = {
        "urinal_only": "alleen urinoir",
        "accessibility": "rolstoel toegankelijk",
        "accessibility_plus": "rolstoel toegankelijk +",
        "fee": "betaald",
        "ownership": "eigendom",
        "name": "naam",
        "openinghours": "openingstijden"
    }
    const valLookup = {
        "true": "ja",
        "false": "nee",
        "private": "privaat",
        "municipal": "gemeentelijk",
        "public": "publiek"
    }
    var table = document.createElement('table');
    table.classList.add("styled-table")

    const orderedKvp = {}
    orderedKvp["name"] = kvps["name"];
    orderedKvp["urinal_only"] = kvps["urinal_only"];
    orderedKvp["ownership"] = kvps["ownership"];
    orderedKvp["fee"] = kvps["fee"];
    orderedKvp["openinghours"] = kvps["openinghours"];
    orderedKvp["accessibility"] = kvps["accessibility"];
    orderedKvp["accessibility_plus"] = kvps["accessibility_plus"];

    Object.keys(orderedKvp).forEach(function (key, index) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        var td2 = document.createElement('td');
        let val = orderedKvp[key]
        if (Object.keys(valLookup).includes(val.toString())) {
            td2.innerText = valLookup[val.toString()]
        } else {
            if (key == "openinghours") {
                let newVal = {}
                newVal["ma"] = val["ma"]
                newVal["di"] = val["di"]
                newVal["wo"] = val["wo"]
                newVal["do"] = val["do"]
                newVal["vr"] = val["vr"]
                newVal["za"] = val["za"]
                newVal["zo"] = val["zo"]

                Object.keys(newVal).forEach(function (key, index) {
                    let day = key
                    let hours = newVal[key]
                    var trH = document.createElement('tr');
                    var td1H = document.createElement('td');
                    var td2H = document.createElement('td');
                    td1H.innerText = day
                    if (hours === "00:00 - 00:00"){
                        hours = "gesloten"
                    }
                    td2H.innerText = hours
                    trH.appendChild(td1H)
                    trH.appendChild(td2H)
                    td2.appendChild(trH)
                })
            } else {
                td2.innerText = val
            }

        }
        td1.innerText = keyLookup[key]

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
    let fts = map.getFeaturesAtPixel(evt.pixel, {
        layerFilter: function (layer) {
            if (layer === vectorLayer) {
                return true
            }
            return false
        }
    })
    if (fts.length > 0) {
        let ft = fts[0]
        let props = ft.getProperties()
        delete props.geometry
        const table = genTableFromKVPs(props)
        content.appendChild(table)
        ftAtPixel = true
    }
    if (ftAtPixel) {
        overlay.setPosition(coordinate);
    } else {
        overlay.setPosition(undefined);
        closer.blur();
    }


});

updateStyle()
document.querySelector(".ol-attribution button").title = "meer informatie"
document.querySelector(".ol-attribution button").addEventListener("click", function (e) {
    e.preventDefault()
    let c1 = document.getElementById("map").classList
    let c2 = document.getElementById("infopanel").classList

    if (c1.contains("collapsed")) {
        c1.remove("collapsed")
        c1.add("expanded")
    } else {
        c1.remove("expanded")
        c1.add("collapsed")
    }
    if (c2.contains("collapsed")) {
        c2.remove("collapsed")
        c2.add("expanded")
    } else {
        c2.remove("expanded")
        c2.add("collapsed")
    }
})


var select = new Select({
    layers: function (layer) {
        if (layer === vectorLayer) {
            return true
        }
        return false
    },
    style: selectedStyle
}
);
map.addInteraction(select);