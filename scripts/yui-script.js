var eventY = YAHOO.util.Event;
var domY = YAHOO.util.Dom;

function toggler()
{
	if(domY.getStyle(toggleSpan[0],"display") == "inline")
	{
		domY.setStyle(toggleSpan[0],"display","none");
		domY.setStyle(toggleSpan[1],"display","inline");
		
		dataSet = [15, 15, 15, 15, 15, 15, 19, 20, 20, 15, 15, 15, 15, 15, 15, 15, 18, 20, 20, 20, 20, 20, 20, 15];
	
	}else if(domY.getStyle(toggleSpan[1],"display") == "inline")
	{
		domY.setStyle(toggleSpan[1],"display","none");
		domY.setStyle(toggleSpan[2],"display","inline");
		
		dataSet = [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 20, 20, 20, 20, 20, 20, 20];
		
	}else if(domY.getStyle(toggleSpan[2],"display") == "inline")
	{
		domY.setStyle(toggleSpan[2],"display","none");
		domY.setStyle(toggleSpan[0],"display","inline");
		
		dataSet = [15, 15, 15, 15, 15, 15, 15, 17.5, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
	}
	
	domY.get("maingraph").innerHTML = "";
	var stackgraph2 =
		new Ico.StackGraph($('maingraph'),
		dataSet,
		{
			labels: ['', '02:00', '', '04:00', '', '06:00', '', '08:00', '', '10:00', '', '12:00', '', '14:00', '', '16:00', '', '18:00', '', '20:00', '', '22:00', '', '24:00'],
			meanline: false,
			markers: 'circle',
			marker_size:10,
			grid: true,
			plot_padding: 0,
			show_vertical_labels: true,
			show_horizontal_labels: true,
			curve_amount: 20,
			background_colour: "#eeeeee",
			draw_axis: false,
			colours: 	{one: '#af4545'},
			label_colour:"#333333",
			hover_colour:"#af4545",
			datalabels: {one:'verplaats punten om temperatuur aan te passen'}
	});
		
}

function initToggler()
{
	toggleA = domY.getElementsByClassName("toggle")[0];
	toggleSpan = toggleA.getElementsByTagName("span");
	domY.setStyle(toggleSpan,"display","none");
	domY.setStyle(toggleSpan[0],"display","inline");
	
	eventY.on(toggleA,"click",toggler);
}


eventY.onDOMReady(initToggler);

