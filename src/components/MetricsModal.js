import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto'; // Import Chart.js
import { downloadMetricsAsCSV, getAllData } from '../utils/IndexDBMetricsController'; // Import the download function and getAllData

const MetricsModal = ({ onClose, onPin, pinned, videoId, sessionID }) => {
    const [chartData, setChartData] = useState(null);
    const [interval, setInterval] = useState(1); // Default interval set to every data point

    const chartRefs = useRef([]); // Ref to store the chart instances

    useEffect(() => {
        // Retrieve data when the component mounts
        const fetchData = async () => {
            const data = await getAllData(videoId);
            const idProperties = ['time', 'guid', 'sessionID', 'bandwidth'];
            const ffmpegProperties = ['startTimestamp', 'debugDuration', 'debugResolution', 'debugVideoCodec', 'debugBitrateString', 'debugAudioCodec'];
            const otherProperties = ['codecSupport', 'connectionSpeed', 'deviceProcessingPower', 'deviceType', 'fetchDuration', 'fetchFromDbDuration', 'playbackEnvironment', 'screenResolution', 'transcodingDuration', 'windowResolution', 'bytesUsed'];
            const propertiesToInclude = [...idProperties, ...ffmpegProperties, ...otherProperties];
            // Initialize chart data array
            const chartData = [];

            data.forEach(item => {
                // Extract Time, GUID, SessionID, and Bandwidth from the ID
                const idParts = item.id.split('_');
                const time = idParts[0];
                const guid = idParts[1];
                const sessionFromID = idParts[2];
                const bandwidth = idParts[3];

                // Parse ffmpeg command
                const ffmpegCommandParts = item.ffmpegCommand.split(' ');
                const startTimestampIndex = ffmpegCommandParts.findIndex(part => part.startsWith('-ss'));
                const debugDurationIndex = ffmpegCommandParts.findIndex(part => part.startsWith('-t'));
                const debugResolutionIndex = ffmpegCommandParts.findIndex(part => part.startsWith('-vf'));
                const debugVideoCodecIndex = ffmpegCommandParts.findIndex(part => part.startsWith('-c:v'));
                const debugBitrateIndex = ffmpegCommandParts.findIndex(part => part.startsWith('-b:v'));
                const debugAudioCodecIndex = ffmpegCommandParts.findIndex(part => part.startsWith('-c:a'));

                const startTimestamp = startTimestampIndex !== -1 ? ffmpegCommandParts[startTimestampIndex + 1] : '';
                const debugDuration = debugDurationIndex !== -1 ? ffmpegCommandParts[debugDurationIndex + 1] : '';
                const debugResolution = debugResolutionIndex !== -1 ? ffmpegCommandParts[debugResolutionIndex].split('=')[1] : '';
                const debugVideoCodec = debugVideoCodecIndex !== -1 ? ffmpegCommandParts[debugVideoCodecIndex + 1] : '';
                const debugBitrateString = debugBitrateIndex !== -1 ? ffmpegCommandParts[debugBitrateIndex + 1] : '';
                const debugAudioCodec = debugAudioCodecIndex !== -1 ? ffmpegCommandParts[debugAudioCodecIndex + 1] : '';

                // Extract other properties
                const otherValues = otherProperties.map(property => item[property] || '');
                console.log(otherValues);
                // Push extracted data to chartData array
                chartData.push({
                    time,
                    bitrate: parseFloat(debugBitrateString) || 0, // Convert bitrate to float (adjust as needed)
                    // Additional data for other charts
                    connectionSpeed: item.connectionSpeed || 0,
                    deviceProcessingPower: item.deviceProcessingPower || 0,
                    playbackEnvironment: item.playbackEnvironment || '',
                    sessionFromID,
                    bytesUsed: parseFloat(item.bytesUsed) / 1000000 || 0, // Convert bytes to MB
                    transcodingDuration: item.transcodingDuration || 0,
                    debugDuration: parseFloat(debugDuration) || 0,
                    // Add more properties as needed for other charts
                });
            });

            // Set chart data
            setChartData(chartData);
        };

        fetchData();
    }, [videoId]);

    const handlePinToggle = () => {
        onPin(!pinned);
    };

    const handleDownload = () => {
        // Call the downloadMetricsAsCSV function with the videoId
        downloadMetricsAsCSV(videoId);
    };

    // Function to handle interval change
    const handleIntervalChange = (e) => {
        setInterval(parseInt(e.target.value));
    };

    useEffect(() => {
        // Create charts when chartData or interval changes
        if (chartData && chartData.length > 0) {
            // Filter chartData based on sessionID
            const filteredData = chartData.filter(dataPoint => dataPoint.sessionFromID === sessionID);
            const filteredDataInterval = filteredData.filter((_, index) => index % interval === 0);

            // Destroy previous chart instances
            chartRefs.current.forEach(chart => {
                if (chart) {
                    chart.destroy();
                }
            });

            // Calculate chart dimensions
            const chartWidth = Math.floor((window.innerWidth * 3) / 4);
            const chartHeight = Math.floor(window.innerHeight / 2);

            // Extract labels and data for the bitrate chart
            const labels = filteredDataInterval.map(dataPoint => dataPoint.time);

            const bitrates = filteredDataInterval.map(dataPoint => dataPoint.bitrate);
            // Count occurrences of each bitrate
            const bitrateCounts = bitrates.reduce((acc, bitrate) => {
                acc[bitrate] = (acc[bitrate] || 0) + 1;
                return acc;
            }, {});

            // Prepare data for the pie chart
            const bitrateLabels = Object.keys(bitrateCounts).map(bitrate => bitrate + 'M');;
            const bitrateData = Object.values(bitrateCounts);

            // Create a new chart instance for bitrate distribution
        const bitrateDistributionCtx = document.getElementById('bitrateDistributionChart').getContext('2d');
        chartRefs.current[3] = new Chart(bitrateDistributionCtx, {
            type: 'pie',
            data: {
                labels: bitrateLabels,
                datasets: [{
                    label: 'Bitrate Distribution Count',
                    data: bitrateData,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(23, 255, 24, 0.7)',
                        'rgba(90, 200, 250, 0.7)',
                        'rgba(200, 150, 80, 0.7)',
                        'rgba(120, 200, 100, 0.7)'
                    ],
                    borderColor: 'rgba(255, 255, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                aspectRatio: chartWidth / chartHeight,
                // Add more options if necessary
            }
        });


            const bytesUsed = filteredDataInterval.map(dataPoint => dataPoint.bytesUsed);
            // Create a new chart instance for connection speed
            const bytesUsedCtx = document.getElementById('bytesUsedChart').getContext('2d');
            chartRefs.current[2] = new Chart(bytesUsedCtx, {
                type: 'bar', // Use bar chart for connection speed
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Bytes Used In Transcoding Process (MB)',
                        data: bytesUsed ,
                        backgroundColor: 'rgba(54, 162, 235, 0.2)', // Blue color for bars
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                },
                aspectRatio: chartWidth / chartHeight,
            });

            // Convert duration strings to seconds
            const transcodingDurationsInSeconds = filteredDataInterval.map(dataPoint => {
                const durationParts = dataPoint.transcodingDuration.split(':').map(parseFloat);
                console.log(durationParts);
                //const seconds = durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];
                //const milliseconds = parseFloat(durationParts[3]);
                //return seconds + milliseconds / 10000000;
                return durationParts[2]
            });
            const debugDurationsInSeconds = filteredDataInterval.map(dataPoint =>  dataPoint.debugDuration);
            const transcodingDurationCtx = document.getElementById('transcodingDurationChart').getContext('2d');
            chartRefs.current[4] = new Chart(transcodingDurationCtx, {
                type: 'line', // Change the chart type to 'line' for a point chart
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Transcoding Duration (seconds)',
                        data: transcodingDurationsInSeconds,
                        pointBackgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        fill: false
                    }, {
                        label: 'Chunk Length (seconds)', // Label for the second line
                        data: debugDurationsInSeconds,
                        pointBackgroundColor: 'rgba(255, 99, 132, 0.7)', // Color for points of the second line
                        borderColor: 'rgba(255, 99, 132, 1)', // Color for the second line
                        borderWidth: 1,
                        fill: false
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                },
                aspectRatio: chartWidth / chartHeight,
            });
        }
    }, [chartData, sessionID, interval]);

    // Return JSX for MetricsModal component
    return (
        <>
            {/* Modal backdrop */}
            {!pinned && <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-gray-900 bg-opacity-50 z-50"></div>}
            {/* Modal container */}
            <div className={`fixed ${pinned ? 'bottom-0 left-0 w-screen' : 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'} z-50`}>
                <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-screen-lg mx-auto">
                    {/* Modal header */}
                    <h2 className="text-2xl font-bold mb-4">Metrics</h2>
                    {/* Interval selection */}
                    <div className="mb-4">
                        <label htmlFor="intervalSelect" className="block font-medium">Data Interval:</label>
                        <select id="intervalSelect" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" onChange={handleIntervalChange} value={interval}>
                            <option value="1">Every data point</option>
                            <option value="5">Every 5th data point</option>
                            <option value="10">Every 10th data point</option>
                            {/* Add more options as needed */}
                        </select>
                    </div>
                    {/* Charts container */}
                    <div className="mb-8">
                        {/* Bitrate chart */}
                        {/*<canvas id="bitrateChart" className="w-full mb-4"></canvas>*/}
                        {/* Connection Speed chart */}
                        {/*<canvas id="connectionSpeedChart" className="w-full"></canvas>*/}
                        {/* Add more charts here... */}
                        <canvas id="bytesUsedChart" className="w-full mb-4"></canvas>
                        <canvas id="bitrateDistributionChart" className="w-full mb-4"></canvas>
                        <canvas id="transcodingDurationChart" className="w-full mb-4"></canvas>


                    </div>
                    {/* Modal footer */}
                    <div className="flex justify-between mt-4">
                        {/*<button onClick={handlePinToggle} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2">*/}
                        {/*    {pinned ? 'Unpin' : 'Pin Under Video'}*/}
                        {/*</button>*/}
                        {!pinned && (
                            <>
                                {/* Download button */}
                                <button onClick={handleDownload} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-2">
                                    Download Metrics
                                </button>
                                {/* Close button */}
                                <button onClick={onClose} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                                    Close
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default MetricsModal;
