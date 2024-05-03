import React, { useState, useEffect, useRef } from 'react';
import {  useParams } from 'react-router-dom';
import getUserData from '../utils/UserDataHandler';
import { getSessionData } from '../utils/SessionStorageHandler';
import { PRODUCTION_URL} from '../VariableTable';
import '../styles/DetailStylesheet.css';
import MetricsModal from '../components/MetricsModal';
import { openDatabase, addData, getAllData } from '../utils/IndexDBMetricsController'; // Import IndexedDB functions

//styles
import Header from '../components/Header';


const DetailPage = () => {
    const [userData, setUserData] = useState(null);
    const [videoData, setVideoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { videoId } = useParams();
    const [eof, setEof] = useState(false);
    const videoRef = useRef(null);
    const [requestSent, setRequestSent] = useState(false);
    const [showUserData, setShowUserData] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [pinnedModal, setPinnedModal] = useState(false); // State to control the pinned modal
    const [sessionID, setSessionID] = useState('');

    useEffect(() => {
        // First, collect user data
        const sessionUserData = getSessionData('userData');
        if (sessionUserData) {
            setUserData(sessionUserData);
        } else {
            const userData = getUserData();
            setUserData(userData);
            // Store user data in session storage for future use
            sessionStorage.setItem('userData', JSON.stringify(userData));
        }

        // Generate a unique session ID only once when the component mounts
        const uniqueSessionID = generateUniqueSessionID();
        setSessionID(uniqueSessionID);
        console.log('Session ID:', uniqueSessionID);

        // Open the database when the component mounts
        openDatabase(videoId)
            .then(() => {
                console.log('Database opened');
            })
            .catch((error) => {
                console.error('Failed to open database', error);
            });

    }, [videoId]); // Call openDatabase only when videoId changes

    // Function to generate a unique session ID
    const generateUniqueSessionID = () => {
        return Math.random().toString(36).substring(7);
    };

    // Function to generate a unique ID
    const generateUniqueID = (time) => {
        const bandwidth = userData ? getUserData().bandwidth : 'unknown';
        return `${time}_${videoId}_${sessionID}_${bandwidth}`;
    };
    const idQueueRef = useRef([]);

    // Function to add an ID to the queue
    const addToQueue = (id) => {
        idQueueRef.current.push(id);
    };

    // Function to remove an ID from the queue
    const removeFromQueue = (id) => {
        idQueueRef.current = idQueueRef.current.filter(queueId => queueId !== id);
    };

    const fetchNextVideoChunk = async () => {
        try {
            const currentTime = videoRef.current ? videoRef.current.currentTime.toFixed(2) : "00:00:00";
            const currentDuration = videoRef.current ? videoRef.current.duration.toFixed(2) : "00:00:00";

            const existingID = idQueueRef.current.find(id => id.startsWith(videoData ? videoData.endTimestamp : "00:00:00"));
            if (existingID) {
                return; // Don't proceed with fetching the next video chunk
            }

            const uniqueID = generateUniqueID(videoData ? videoData.endTimestamp : "00:00:00");
            addToQueue(uniqueID); // Add the unique ID to the queue
            const startFetchTime = new Date();
            const response = await fetch(PRODUCTION_URL + '/api/transcode-video', {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoId: videoId,
                    timestamp: currentTime,
                    newStartTime: videoData ? videoData.endTimestamp : "00:00:00",
                    duration: currentDuration,
                    userData: getUserData(),
                    uniqueID: uniqueID, // Send unique ID with the request
                    transcodingTime: videoData ? videoData.transcodingTime : 0, // Send transcoding time of the last chunk
                }),
            });

            if (response.ok) {
                const endFetchTime = new Date();
                const timeDifference = endFetchTime - startFetchTime; // Time difference in milliseconds

                const responseData = await response.json();
                if (idQueueRef.current.includes(responseData.uniqueID)) {
                    removeFromQueue(responseData.uniqueID); // Remove the unique ID from the queue
                    if (responseData && responseData.VideoContentBase64) {
                        setVideoData({
                            videoContent: responseData.VideoContentBase64,
                            endTimestamp: responseData.EndTimestamp,
                            duration: responseData.ChunkLength,
                            transcodingTime: responseData.TranscodingDuration, // Update transcoding time for the next fetch call
                        });
                        setEof(responseData.eof);
                        console.log('is eof:', responseData.eof);
                        setLoading(false);

                        // Store data in IndexedDB
                        const data = {
                            id: uniqueID,
                            ...getUserData(),
                            fetchDuration: timeDifference,
                            transcodingDuration: responseData.TranscodingDuration,
                            fetchFromDbDuration: responseData.FetchFromDbDuration,
                            ffmpegCommand: responseData.FFmpegCommand,
                            bytesUsed : responseData.MemoryUsed,
                        };
                        addData(videoId, data)
                            .then(() => {
                                console.log('Data stored in IndexedDB');
                            })
                            .catch((error) => {
                                console.error('Failed to store data in IndexedDB', error);
                            });
                    } else {
                        setError('Video content is missing in the response');
                    }
                } else {
                    setError('Unique ID not found in the queue');
                }
            } else {
                setError(`Error fetching video: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            setError(`Error fetching video: ${error}`);
        }
    };

    useEffect(() => {
        if (!eof) {
            fetchNextVideoChunk();
        }
    }, [eof]);

    const handleTimeUpdate = () => {
        if (
            videoRef.current &&
            videoRef.current.currentTime >= 0.1 * videoRef.current.duration &&
            !eof &&
            !requestSent
        ) {
            const currentTimestamp = videoRef.current.currentTime.toFixed(2);
            const existingRequest = idQueueRef.current.find(id => id.split('-')[0] === currentTimestamp);
            if (!existingRequest) {
                fetchNextVideoChunk();
                setRequestSent(true);
            }
        } else if (videoRef.current && videoRef.current.currentTime >= videoRef.current.duration && videoData) {
            videoRef.current.src = `data:video/webm;base64,${videoData.videoContent}`;
            videoRef.current.play();
            setRequestSent(false);
        }
    };

    const handleLoadedData = () => {
        if (!eof) {
            if (videoRef.current.paused) {
                videoRef.current.play();
            }
        }
    };

    const handlePinModal = () => {
        setShowModal(false);
        setPinnedModal(!pinnedModal);
    };

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-white text-gray-800 relative">
            {/* Header */}
            <Header pageTitle="Detail Page" />
            {/* Main content */}
            <div className="flex justify-center items-center mb-8">
                <div className="w-95vw max-w-6xl text-center px-4">

                    <div className="flex-grow w-95vw flex justify-center items-center relative">
                        <div style={{ width: '75%', maxWidth: '100%', height: 'auto' }} className="relative">
                            {loading && !videoData && (
                                <div className="absolute inset-0 bg-gray-300 opacity-50 z-0 flex justify-center items-center">
                                    <div className="loader-spinner"></div>
                                </div>
                            )}
                            {loading && (
                                <div className="absolute inset-0 flex justify-center items-center z-1">
                                    <div className="loader-spinner"></div>
                                </div>
                            )}
                    {videoData && (
                        <video
                            ref={videoRef}
                            controls
                            style={{ width: '100%', height: 'auto' }}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedData={handleLoadedData}
                            autoPlay
                            className="z-2"
                        >
                            <source src={`data:video/webm;base64,${videoData.videoContent}`} type="video/webm" />
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
                {/* Modal button */}
                {!pinnedModal && (
                    <button className="fixed bottom-20 right-5 m-4 p-2 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded-full shadow-md transition-transform duration-300 transform" onClick={() => setShowModal(true)}>
                        Open Metrics
                    </button>
                )}

                {/* Metrics modal */}
                {(showModal || pinnedModal) && (
                    <MetricsModal
                        onClose={() => setShowModal(false)}
                        onPin={handlePinModal}
                        pinned={pinnedModal}
                        videoId={videoId}
                        sessionID = {sessionID}
                    />
                )}


                {/* Display user data button */}
                <div className="fixed bottom-5 right-5 m-4 p-2 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded-full shadow-md transition-transform duration-300 transform">
                    <button onClick={() => setShowUserData(!showUserData)}>
                        {showUserData ? 'Hide User Data' : 'Show User Data'}
                    </button>
                </div>

                {/* Display user data drawer */}
                <div className={`fixed bottom-0 left-0 right-0 bg-white p-4 transition-transform duration-300 transform ${showUserData ? 'translate-y-0' : 'translate-y-full'}`}>
                    <button
                        onClick={() => setShowUserData(false)}
                        className="absolute top-0 right-0 m-4 p-2 bg-gray-200 rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {userData && (
                        <div>
                            <p>Device Type: {userData.deviceType}</p>
                            <p>Screen Resolution: {userData.screenResolution}</p>
                            <p>Window Resolution: {userData.windowResolution}</p>
                            <p>Browser Info: {userData.browserInfo}</p>
                            <p>Bandwidth: {userData.bandwidth}</p>
                            <p>Connection Speed: {userData.connectionSpeed}</p>
                            <p>Playback Environment: {userData.playbackEnvironment}</p>
                            <p>Device Processing Power: {userData.deviceProcessingPower}</p>
                        </div>
                    )}
                </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default DetailPage;
