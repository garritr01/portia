import React from 'react';
import { createPortal } from 'react-dom';

const Floater = ({ children, ref }) => {
	if (!ref) return null;
	return createPortal(
		<div className="portal">{children}</div>,
		ref
	);
};
