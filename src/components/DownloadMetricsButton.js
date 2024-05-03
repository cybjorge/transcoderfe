import React from 'react';
import { getAllData } from '../utils/IndexDBMetricsController'; // Assuming this is the path to your controller file

class DownloadMetricsButton extends React.Component {
    handleDownload = async (videoGuid) => {
        try {
            // Retrieve all data from IndexDB
            console.log('Downloading metrics...');
            const data = await getAllData(videoGuid);

            // Prepare CSV content
            let csvContent = 'Date,Value\n'; // CSV header
            data.forEach(item => {
                // Format each item as CSV row
                csvContent += `${item.date},${item.value}\n`;
            });

            // Create a Blob with the CSV content
            const blob = new Blob([csvContent], { type: 'text/csv' });

            // Create a URL for the Blob
            const url = URL.createObjectURL(blob);

            // Create a link element to trigger the download
            const link = document.createElement('a');
            link.href = url;
            link.download = `${videoGuid}_metrics.csv`;
            document.body.appendChild(link);

            // Click the link to start the download
            link.click();

            // Clean up
            URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error occurred while downloading metrics:', error);
        }
    };

    render() {
        return (
            <button onClick={this.handleDownload}>Download Metrics</button>
        );
    }
}

export default DownloadMetricsButton;