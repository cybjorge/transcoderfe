const DB_NAME = 'videoDataDB_production';
let DB_VERSION = 2;

let db; // Database reference


// Function to open the database
const openDatabase = (videoId, version = DB_VERSION) => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, version);

        request.onerror = (event) => {
            console.error('Failed to open database', event.target.error);
            const newVersion = version + 1;
            console.log(`Opening database with new version from error: ${newVersion}`);
            openDatabase(videoId, newVersion)
                .then(resolve)
                .catch(reject);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');

            if (!db.objectStoreNames.contains(videoId)) {
                console.log(`Object store '${videoId}' doesn't exist`);
                // If the object store doesn't exist, close the current database and open a new one with an incremented version
                db.close();
                const newVersion = version + 1;
                console.log(`Opening database with new version: ${newVersion}`);
                openDatabase(videoId, newVersion)
                    .then(resolve)
                    .catch(reject);
            } else {
                // If the object store exists, resolve immediately
                resolve();
            }
        };

        request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed');
            const upgradedDB = event.target.result;

            // Recreate older object stores if necessary
            const oldObjectStoreNames = Array.from(upgradedDB.objectStoreNames);
            oldObjectStoreNames.forEach((name) => {
                if (!db.objectStoreNames.contains(name)) {
                    const oldStore = upgradedDB.transaction.objectStore(name);
                    const newStore = upgradedDB.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
                    console.log(`Recreated object store '${name}' successfully`);

                    // Migrate data from the old object store to the new one
                    oldStore.openCursor().onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            newStore.add(cursor.value);
                            cursor.continue();
                        }
                    };
                }
            });

            // Create new object store for the videoId
            upgradedDB.createObjectStore(videoId, { keyPath: 'id', autoIncrement: true });
            console.log(`Object store '${videoId}' created successfully in the upgraded database`);
        };
    });
};



// Function to check if an object store with a given GUID exists and create it if not
const checkAndCreateTable = (videoGuid) => {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(videoGuid)) {
            // Object store doesn't exist, create it
            const objectStore = db.createObjectStore(videoGuid, { keyPath: 'id', autoIncrement: true });
            console.log(`Object store '${videoGuid}' created successfully`);
        }
        console.log(`Object store '${videoGuid}' was already existing`);

        resolve();
    });
};

// Function to add data to the database
const addData = (videoGuid, data) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([videoGuid], 'readwrite');
        const objectStore = transaction.objectStore(videoGuid);
        const request = objectStore.add(data);

        request.onsuccess = () => {
            console.log(`Data added to object store '${videoGuid}' successfully`);
            resolve();
        };

        request.onerror = (event) => {
            console.error(`Failed to add data to object store '${videoGuid}': ${event.target.error}`);
            reject(event.target.error);
        };
    });
};
// Function to retrieve all data from the database

const getAllData = (videoGuid) => {
    return new Promise((resolve, reject) => {
        // Check if the object store exists before opening the transaction
        if (!db.objectStoreNames.contains(videoGuid)) {
            console.error(`Object store '${videoGuid}' does not exist`);
            reject(new Error(`Object store '${videoGuid}' does not exist`));
            return;
        }

        // Open transaction and retrieve data from the object store
        const transaction = db.transaction([videoGuid], 'readonly');
        const objectStore = transaction.objectStore(videoGuid);
        const request = objectStore.getAll();

        request.onsuccess = () => {
            const data = request.result;

            console.log(`Retrieved data from object store '${videoGuid}' successfully`);
            //console.log(data);
            resolve(data);
        };

        request.onerror = (event) => {
            console.error(`Failed to retrieve data from object store '${videoGuid}': ${event.target.error}`);
            reject(event.target.error);
        };
    });
};

const downloadMetricsAsCSV = async (videoGuid) => {
    try {
        // Retrieve all data from IndexedDB
        const data = await getAllData(videoGuid);

        // Prepare CSV content
        let csvContent = ''; // Initialize CSV content
        // Extract the properties to include in the CSV (customize as needed)
        const idProperties = ['time', 'guid', 'sessionID', 'bandwidth'];
        const ffmpegProperties = ['startTimestamp', 'debugDuration', 'debugResolution', 'debugVideoCodec', 'debugBitrateString', 'debugAudioCodec'];
        const otherProperties = ['codecSupport', 'connectionSpeed', 'deviceProcessingPower', 'deviceType', 'fetchDuration', 'fetchFromDbDuration', 'playbackEnvironment', 'screenResolution', 'transcodingDuration', 'windowResolution','bytesUsed'];

        // Add CSV header with selected properties
        const propertiesToInclude = [...idProperties, ...ffmpegProperties, ...otherProperties];
        csvContent += `${propertiesToInclude.join(',')}\n`;

        // Add data rows
        data.forEach(item => {
            // Extract Time, GUID, SessionID, and Bandwidth from the ID
            const idParts = item.id.split('_');
            const time = idParts[0];
            const guid = idParts[1];
            const sessionID = idParts[2];
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

            // Extract values of selected properties and join them with commas
            const rowValues = [
                time,
                guid,
                sessionID,
                bandwidth,
                startTimestamp,
                debugDuration,
                debugResolution,
                debugVideoCodec,
                debugBitrateString,
                debugAudioCodec,
                ...otherValues
            ];
            csvContent += `${rowValues.join(',')}\n`;
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


export { openDatabase, addData, getAllData, checkAndCreateTable, downloadMetricsAsCSV };
