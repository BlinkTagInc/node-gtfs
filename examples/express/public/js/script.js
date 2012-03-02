// usage: log('inside coolFunc', this, arguments);
// paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function f(){ log.history = log.history || []; log.history.push(arguments); if(this.console) { var args = arguments, newarr; args.callee = args.callee.caller; newarr = [].slice.call(args); if (typeof console.log === 'object') log.apply.call(console.log, console, newarr); else console.log.apply(console, newarr);}};

// make it safe to use console.log always
(function(a){function b(){}for(var c="assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(","),d;!!(d=c.pop());){a[d]=a[d]||b;}})
(function(){try{console.log();return window.console;}catch(a){return (window.console={});}}());

$(document).ready(function(){
  //load all agencies on pageload
  getAgencies();
  
  $('#data').on('click', '#agencies tbody tr', getRoutes);
  $('#data').on('click', '#routes tbody tr', getStops);
});


function getAgencies(){
  $('#data').fadeOut('fast');
  $.getJSON('api/agencies', function(data){
    $('.conatiner h1').html('Agencies');
    renderTable(data, 'agencies');
  });
}

function getRoutes(){
  $('#data').fadeOut('fast');
  $.getJSON('api/routes/' + $(this).attr('data-agency-key'), function(data){
    $('.container h1').html('Routes');
    renderTable(data, 'routes');
  });
}

function getStops(){
  $('#data').fadeOut('fast');
  console.log('api/stops/' + $(this).attr('data-agency-key') + '/' + $(this).attr('data-route-id'))
  console.log(this)
  $.getJSON('api/stops/' + $(this).attr('data-agency-key') + '/' + $(this).attr('data-route-id'), function(data){
    $('.container h1').html('Stops');
    renderTable(data, 'stops');
  });
}


function renderTable(data, id){
  var columns = [];
  $('#data').html('<table class="table table-bordered table-striped"><thead><tr></tr></thead><tbody></tbody></table>');
  $('#data table').attr('id', id);
  for(var key in data[0]){
    if(key != '_id'){
        columns.push(key);
        //build table header
        $('#data table thead tr').append('<th>' + key + '</th>')
      }
    
  }
  data.forEach(function(item, index){
    var row = $('<tr>')
    columns.forEach(function(column, index){
      if(typeof item[column] != 'object'){
        $(row).append('<td>' + item[column] + '</td>');
      } else {
        $(row).append('<td>' + JSON.stringify(item[column]) + '</td>')
      }
    });
    switch(id){
      case 'agencies':
        $(row).attr('data-agency-key', item.agency_key);
        break;
      case 'routes':
        $(row).attr('data-agency-key', item.agency_key);
        $(row).attr('data-route-id', item.route_id);
        break;
      case 'routes':
        $(row).attr('data-agency-key', item.agency_key);
        $(row).attr('data-route-id', item.route_id);
        $(row).attr('data-stop-id', item.stop_id);
        break;
  
    }
    $('#data table tbody').append(row);
  });
  $('#data').fadeIn('fast');
}