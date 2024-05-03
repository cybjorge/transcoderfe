// Header.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as Logo } from '../styles/icons/logo.drawio.svg';

const Header = ({ pageTitle }) => {
    return (
        <div className="flex justify-between items-center p-4 bg-gray-700 mb-8"> {/* Added margin-bottom */}
            <div className="flex items-center">
                <Link to="/">
                    <div className="flex items-center"> {/* Wrap logo and text in a flex container */}
                        <Logo className="logo" style={{ width: '5%', height: '5%', marginRight: '10px' }} />
                        <h1 className="text-xl font-semibold text-white">{pageTitle}</h1>
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default Header;
