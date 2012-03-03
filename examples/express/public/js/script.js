// usage: log('inside coolFunc', this, arguments);
// paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function f(){ log.history = log.history || []; log.history.push(arguments); if(this.console) { var args = arguments, newarr; args.callee = args.callee.caller; newarr = [].slice.call(args); if (typeof console.log === 'object') log.apply.call(console.log, console, newarr); else console.log.apply(console, newarr);}};

// make it safe to use console.log always
(function(a){function b(){}for(var c="assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(","),d;!!(d=c.pop());){a[d]=a[d]||b;}})
(function(){try{console.log();return window.console;}catch(a){return (window.console={});}}());

var agencies = {};

$(document).ready(function(){
  //load all agencies on pageload
  getAgencies();
  
  $('#data')
    .on('click', '#agencies tbody tr', getRoutes)
    .on('click', '#routes tbody tr', getStops)
    .on('click', '#stops tbody tr', getStop);

  $('#nav-button').on('click', function(){
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
  console.log(agency_key);
  console.log(route_id);
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
  $('.conatiner h1').html('Stop: ' + $(this).attr('data-stop-name'));
  $('#data')
    .html('<div>Coordinates: ' + $(this).attr('data-stop-lat') + ', ' +  $(this).attr('data-stop-lon') + '</div>')
    .append('<div>Stop ID: ' + $(this).attr('data-stop-id') + '</div>')
    .append('<div>Agency Key: ' + $(this).attr('data-agency-key') + '</div>');

  $('#nav-button').attr('data-previous', 'stops');
  $('#nav-button').attr('data-route-id', $(this).attr('data-route-id'));
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
      $('.container h1').html('Routes');
      data = agencies[agency_key].routes;
      break;
    case 'stops':
      $('.container h1').html('Stops');
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
        $(row).attr('data-stop-name', item.stop_name);
        $(row).attr('data-stop-lat', item.stop_lat);
        $(row).attr('data-stop-lon', item.stop_lon);
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
