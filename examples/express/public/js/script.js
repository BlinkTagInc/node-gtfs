// usage: log('inside coolFunc', this, arguments);
// paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function f(){ log.history = log.history || []; log.history.push(arguments); if(this.console) { var args = arguments, newarr; args.callee = args.callee.caller; newarr = [].slice.call(args); if (typeof console.log === 'object') log.apply.call(console.log, console, newarr); else console.log.apply(console, newarr);}};

// make it safe to use console.log always
(function(a){function b(){}for(var c="assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(","),d;!!(d=c.pop());){a[d]=a[d]||b;}})
(function(){try{console.log();return window.console;}catch(a){return (window.console={});}}());

var agencies = {}
  , map
  , markerGroup = new L.LayerGroup()
  , cloudmadeAPI = '7a80f6e2fb44480bb068f596f4736073';

$(document).ready(function(){

  //setup map
  map = new L.Map('map');
  var cloudmade = new L.TileLayer('http://{s}.tile.cloudmade.com/' + cloudmadeAPI + '/997/256/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
    maxZoom: 18
  });
  map.addLayer(cloudmade);

  $('#data').on('click', 'tbody tr', function(){
      switch($('#data').attr('data-view-type')){
        case 'agencies':
          getRoutes.call(this);
          break;
        case 'routes':
          getStops.call(this);
          break;
        case 'stops':
          getStop.call(this);
          break;
        case 'agenciesNearby':
          getRoutes.call(this);
          break;
        case 'routesNearby':
          getStops.call(this);
          break;
      }
    });

  $('#nav-button').on('click', function(){
    $('#map').hide();

    switch($(this).attr('data-previous')){
      case 'agencies':
        getAgencies();
        break;
      case 'routes':
        getRoutes.call(this);
        break;
      case 'stops':
        getStops.call(this);
        break;
    }
  });

  $('#top-menu')
    .on('click', 'a', function(){
      $(this).parent()
        .addClass('active')
        .siblings().removeClass('active');

      $('#map').hide();
      $('#nav-button').hide();
      return false;
    })
    .on('click', '#all-agencies', getAgencies)
    .on('click', '#agencies-by-location', function(){
      $('#data').empty();
      $('#pageTitle').html('Find Agencies by Location');
      $('#locationForm input[type=submit]').val('Find Agencies');
      $('#locationForm')
        .attr('data-form-type', 'agencies')
        .show();
    })
    .on('click', '#routes-by-location', function(){
      $('#data').empty();
      $('#pageTitle').html('Find Routes by Location');
      $('#locationForm input[type=submit]').val('Find Routes');
      $('#locationForm')
        .attr('data-form-type', 'routes')
        .show();
    })
    .on('click', '#stops-by-location', function(){
      $('#data').empty();
      $('#pageTitle').html('Find Stops by Location');
      $('#locationForm input[type=submit]').val('Find Stops');
      $('#locationForm')
        .attr('data-form-type', 'stops')
        .show();
    });;

  //form handler
  $('#locationForm').submit(function(){

    if($('#location').val() != ''){
      $('#locationForm fieldset').removeClass('error');
      //disable button
      $('#locationForm input[type=submit]').attr('disabled', 'disabled');

      //geocode
      var geocodeQuery = $('#location').val().replace(/\s/g,'+');
      $.getJSON('http://geocoding.cloudmade.com/' + cloudmadeAPI + '/geocoding/v2/find.js?query=' + geocodeQuery + '&return_location=true&callback=?', function(data){
        $('#locationForm input[type=submit]').removeAttr('disabled');
        
        if(data.features){

          //get first result from geocoding
          var lat = data.features[0].centroid.coordinates[0]
            , lon = data.features[0].centroid.coordinates[1]
            , radius = $('#radius').val();

          switch($('#locationForm').attr('data-form-type')){
            case 'agencies':
              getAgenciesNearby(lat, lon, radius);
              break;
            case 'routes':
              getRoutesNearby(lat, lon, radius);
              break;
            case 'stops':
              getStopsNearby(lat, lon, radius);
              break;
          }

        } else {
          $('#locationForm fieldset').addClass('error');
        }
      });

    } else {
      $('#locationForm fieldset').addClass('error');
    }
    return false;
  });
  
});


function getAgencies(){
  $('#data').attr('data-view-type', 'agencies');
  $('#locationForm').hide();
  $('#data').show();
  $('#pageTitle').html('Agencies');

  if(!Object.keys(agencies).length){
    $.getJSON('api/agencies', function(data){
      data.forEach(function(agency){
        agencies[agency.agency_key] = agency;
      });
      renderTable(agencies, 'agencies');
    });
  } else {
    renderTable(agencies, 'agencies');
  }
}

function getRoutes(){
  var agency_key = $(this).attr('data-agency-key');

  $('#data').attr('data-view-type', 'routes');


  $('#pageTitle').html('Routes for ' + agencies[agency_key].agency_name);

  $('#map').hide();

  $('#nav-button').attr('data-agency-key', agency_key);
  $('#nav-button').attr('data-previous', 'agencies');

  if(!agencies[agency_key].routes){
    agencies[agency_key].routes = {};
    $.getJSON('api/routes/' + agency_key, function(data){
      data.forEach(function(route){
        agencies[agency_key].routes[route.route_id] = route;
      });
      renderTable(agencies[agency_key].routes, 'routes');
    });
  } else {
    renderTable(agencies[agency_key].routes, 'routes');
  }
}

function getStops(){
  var agency_key = $(this).attr('data-agency-key')
    , route_id = $(this).attr('data-route-id');

  $('#data').attr('data-view-type', 'stops');

  $('#data').attr('data-route-id', route_id);

  $('#pageTitle').html('Stops on Route ' + agencies[agency_key].routes[route_id].route_short_name + ': ' + agencies[agency_key].routes[route_id].route_long_name);

  $('#nav-button').attr('data-agency-key', agency_key);
  $('#nav-button').attr('data-route-id', route_id);
  $('#nav-button').attr('data-previous', 'routes');

  if(!agencies[agency_key].routes[route_id].stops){
    agencies[agency_key].routes[route_id].stops = {};
    $.getJSON('api/stops/' + agency_key + '/' + route_id, function(data){
      data.forEach(function(stop){
        agencies[agency_key].routes[route_id].stops[stop.stop_id] = stop;
      });
      renderTable(agencies[agency_key].routes[route_id].stops, 'stops');
    });
  } else {
    renderTable(agencies[agency_key].routes[route_id].stops, 'stops');
  }
}

function getStop(){
  var agency_key = $(this).attr('data-agency-key')
    , route_id = $(this).attr('data-route-id')
    , stop_id = $(this).attr('data-stop-id')
    , stop = agencies[agency_key].routes[route_id].stops[stop_id];

  $('#data').attr('data-view-type', 'stop');

  $('#pageTitle').html('Stop: ' + stop.stop_name);
  $('#data').html('<div>Coordinates: ' + stop.stop_lat + ', ' + stop.stop_lon + '</div>');
  $('#nav-button').attr('data-previous', 'stops');
  $('#nav-button').attr('data-route-id', route_id);


  //render map
  $('#map').show();

  markerGroup.clearLayers();

  var lat = parseFloat(stop.stop_lat);
  var lon = parseFloat(stop.stop_lon);
  var stop_loc = new L.LatLng(lat, lon);
  map.setView(stop_loc, 13);

  var marker = new L.Marker(stop_loc);
  markerGroup.addLayer(marker);
  map.addLayer(markerGroup);

  var popupContent = '<strong>' + stop.stop_name + '</strong><br>' + 
                     'Stop ID: ' + stop_id + '<br>' + 
                     'Route: ' + route_id + '<br>' + 
                     'Agency: ' + agencies[agency_key].agency_name;


  marker.bindPopup(popupContent).openPopup();

}

function getAgenciesNearby(lat, lon, radius){
  var agenciesNearby = {};

  $('#data').attr('data-view-type', 'agenciesNearby');

  $.getJSON('/api/agenciesNearby/' + lat + '/' + lon + '/' + radius || '', function(data){
    if(data.length){
      //render map
      $('#map').show();

       markerGroup.clearLayers();

      var mapCenter = new L.LatLng(lat, lon);
      var mapBounds = new L.LatLngBounds([]);
      map.setView(mapCenter, 13);

      data.forEach(function(agency){
        agenciesNearby[agency.agency_key] = agency;

        var agency_center = new L.LatLng(agency.agency_center[1], agency.agency_center[0]);
        mapBounds.extend(agency_center);

        var popupContent = '<strong>' + agency.agency_name + '</strong><br>' + 
                       'Site: ' + agency.agency_url + '<br>' + 
                       'Phone: ' + agency.agency_phone + '<br>' + 
                       'agency_key: ' + agency.agency_key;

        var marker = new L.Marker(agency_center);
        marker.bindPopup(popupContent).openPopup(); 
        markerGroup.addLayer(marker);
      });

      map.addLayer(markerGroup);
      map.fitBounds(mapBounds);
      renderTable(agenciesNearby, 'agenciesNearby');
    } else {
      $('#data').html('No agencies within ' + radius + ' miles');
    }
  });
}

function getRoutesNearby(lat, lon, radius){
  var routesNearby = {};

  $('#data').attr('data-view-type', 'routesNearby');

  $.getJSON('/api/routesNearby/' + lat + '/' + lon + '/' + radius || '', function(data){
    if(data.length){
      data.forEach(function(route){
        routesNearby[route.route_id] = route;
        if(!agencies[route.agency_key].hasOwnProperty('routes')){
          agencies[route.agency_key].routes = {};
        }
        agencies[route.agency_key].routes[route.route_id] = route;
      });

      renderTable(routesNearby, 'routesNearby');
    } else {
      $('#data').html('No routes within ' + radius + ' miles');
    }

  });
}

function getStopsNearby(lat, lon, radius){
  var stopsNearby = {};

  $('#data').attr('data-view-type', 'stopsNearby');

  $.getJSON('/api/stopsNearby/' + lat + '/' + lon + '/' + radius || '', function(data){
    if(data.length){
      //render map
      $('#map').show();

      markerGroup.clearLayers();
      
      var mapCenter = new L.LatLng(lat, lon);
      var mapBounds = new L.LatLngBounds([]);
      map.setView(mapCenter, 13);

      data.forEach(function(stop){
        stopsNearby[stop.stop_id] = stop;

        var stop_loc = new L.LatLng(stop.loc[1], stop.loc[0]);
        mapBounds.extend(stop_loc);

        var popupContent = '<strong>' + stop.stop_name + '</strong><br>' + 
                       'Stop ID: ' + stop.stop_id + '<br>' + 
                       'Coordinates: ' + stop.loc[1] + ', ' + stop.loc[0] + '<br>' + 
                       'agency_key: ' + stop.agency_key;

        var marker = new L.Marker(stop_loc);
        marker.bindPopup(popupContent).openPopup();
        markerGroup.addLayer(marker);
      });

      map.addLayer(markerGroup);
      map.fitBounds(mapBounds);
      renderTable(stopsNearby, 'stopsNearby');
    } else {
      $('#data').html('No stops within ' + radius + ' miles');
    }

  });
}

function renderTable(data, viewType){
  var columns = []
    , sortVariable;

  $('#data').html('<table class="table table-bordered table-striped"><thead><tr></tr></thead><tbody></tbody></table>');
  $('#data table').attr('id', viewType);
  for(var key in data){
    var item = data[key]
      , row = $('<tr>');

    //determine column names
    if(!columns.length){
      for(var key in item){
        if(key != '_id' && key != 'routes' && key != 'stops'){
          columns.push(key);
          //build table header
          $('#data table thead tr').append('<th>' + key + '</th>')
        }
      }
    }

    columns.forEach(function(column, index){
      var value = (typeof item[column] != 'object') ? item[column] : JSON.stringify(item[column]);
      value = (value !== undefined) ? value : '';
      $(row).append('<td>' + value + '</td>');
    });

    switch(viewType){
      case 'agencies':
        $(row).attr('data-agency-key', item.agency_key);
        break;
      case 'agenciesNearby':
        $(row).attr('data-agency-key', item.agency_key);
        break;
      case 'routes':
        $(row).attr('data-agency-key', item.agency_key);
        $(row).attr('data-route-id', item.route_id);
        break;
      case 'routesNearby':
        $(row).attr('data-agency-key', item.agency_key);
        $(row).attr('data-route-id', item.route_id);
        break;
      case 'stops':
        var route_id = $('#data').attr('data-route-id');
        $(row).attr('data-agency-key', item.agency_key);
        $(row).attr('data-route-id', route_id);
        $(row).attr('data-stop-id', item.stop_id);
        break;
  
    }
    $('#data table tbody').append(row);
  };

  if(viewType != 'agencies'){
    $('#nav-button').show();
  } else {
    $('#nav-button').hide();
  }
}
