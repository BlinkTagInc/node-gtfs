// usage: log('inside coolFunc', this, arguments);
// paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function f(){ log.history = log.history || []; log.history.push(arguments); if(this.console) { var args = arguments, newarr; args.callee = args.callee.caller; newarr = [].slice.call(args); if (typeof console.log === 'object') log.apply.call(console.log, console, newarr); else console.log.apply(console, newarr);}};

// make it safe to use console.log always
(function(a){function b(){}for(var c="assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(","),d;!!(d=c.pop());){a[d]=a[d]||b;}})
(function(){try{console.log();return window.console;}catch(a){return (window.console={});}}());

var agencies = {}
  , map;

$(document).ready(function(){
  //load all agencies on pageload
  getAgencies();
  
  $('#data')
    .on('click', '#agencies tbody tr', getRoutes)
    .on('click', '#routes tbody tr', getStops)
    .on('click', '#stops tbody tr', getStop);

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
  

  //setup map
  map = new L.Map('map');
  var cloudmade = new L.TileLayer('http://{s}.tile.cloudmade.com/7a80f6e2fb44480bb068f596f4736073/997/256/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
    maxZoom: 18
  });
  map.addLayer(cloudmade);

});


function getAgencies(){

  if(!Object.keys(agencies).length){
    $.getJSON('api/agencies', function(data){
      data.forEach(function(agency){
        agencies[agency.agency_key] = agency;
      });
      renderTable('agencies');
    });
  } else {
    renderTable('agencies');
  }
}

function getRoutes(){
  var agency_key = $(this).attr('data-agency-key');

  if(!agencies[agency_key].routes){
    agencies[agency_key].routes = {};
    $.getJSON('api/routes/' + agency_key, function(data){
      data.forEach(function(route){
        agencies[agency_key].routes[route.route_id] = route;
      });
      renderTable('routes', agency_key);
    });
  } else {
    renderTable('routes', agency_key);
  }
}

function getStops(){
  var agency_key = $(this).attr('data-agency-key')
    , route_id = $(this).attr('data-route-id');
  if(!agencies[agency_key].routes[route_id].stops){
    agencies[agency_key].routes[route_id].stops = {};
    $.getJSON('api/stops/' + agency_key + '/' + route_id, function(data){
      data.forEach(function(stop){
        agencies[agency_key].routes[route_id].stops[stop.stop_id] = stop;
      });
      renderTable('stops', agency_key, route_id);
    });
  } else {
    renderTable('stops', agency_key, route_id);
  }
}

function getStop(){
  var agency_key = $(this).attr('data-agency-key')
    , route_id = $(this).attr('data-route-id')
    , stop_id = $(this).attr('data-stop-id')
    , stop = agencies[agency_key].routes[route_id].stops[stop_id];

  $('.container h1').html('Stop: ' + stop.stop_name);
  $('#data').html('<div>Coordinates: ' + stop.stop_lat + ', ' + stop.stop_lon + '</div>');
  $('#nav-button').attr('data-previous', 'stops');
  $('#nav-button').attr('data-route-id', route_id);


  //render map
  $('#map').show();

  var lat = parseFloat(stop.stop_lat);
  var lon = parseFloat(stop.stop_lon);
  var stop_loc = new L.LatLng(lat, lon);
  map.setView(stop_loc, 13);

  var marker = new L.Marker(stop_loc);
  map.addLayer(marker);

  var popupContent = '<strong>' + stop.stop_name + '</strong><br>' + 
                     'Stop ID: ' + stop_id + '<br>' + 
                     'Route: ' + route_id + '<br>' + 
                     '<div>Agency: ' + agencies[agency_key].agency_name;


  marker.bindPopup(popupContent).openPopup();

}


function renderTable(tableType, agency_key, route_id){
  var columns = []
    , data = []
    , sortVariable;

  switch(tableType){
    case 'agencies':
      $('.container h1').html('Agencies');
      data = agencies;
      break;
    case 'routes':
      $('.container h1').html('Routes for ' + agencies[agency_key].agency_name);
      data = agencies[agency_key].routes;
      break;
    case 'stops':
      $('.container h1').html('Stops on Route ' + agencies[agency_key].routes[route_id].route_short_name + ': ' + agencies[agency_key].routes[route_id].route_long_name);
      data = agencies[agency_key].routes[route_id].stops;
      break;
  }

  $('#data').html('<table class="table table-bordered table-striped"><thead><tr></tr></thead><tbody></tbody></table>');
  $('#data table').attr('id', tableType);
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

    switch(tableType){
      case 'agencies':
        $(row).attr('data-agency-key', item.agency_key);
        break;
      case 'routes':
        $(row).attr('data-agency-key', item.agency_key);
        $(row).attr('data-route-id', item.route_id);
        $('#nav-button').attr('data-agency-key', item.agency_key);
        $('#nav-button').attr('data-previous', 'agencies');
        break;
      case 'stops':
        $(row).attr('data-agency-key', item.agency_key);
        $(row).attr('data-route-id', route_id);
        $(row).attr('data-stop-id', item.stop_id);
        $('#nav-button').attr('data-agency-key', item.agency_key);
        $('#nav-button').attr('data-route-id', item.route_id);
        $('#nav-button').attr('data-previous', 'routes');
        break;
  
    }
    $('#data table tbody').append(row);
  };

  if(tableType != 'agencies'){
    $('#nav-button').fadeIn();
  } else {
    $('#nav-button').fadeOut();
  }
}
