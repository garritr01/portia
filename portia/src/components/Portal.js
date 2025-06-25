import { createPortal } from 'react-dom';

export const Floater = ({ children }) => {
	return createPortal(
		<div className="portal">{children}</div>,
		document.body
	);
};