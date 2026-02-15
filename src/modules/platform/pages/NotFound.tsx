/**
 * @module platform
 * @page NotFound
 *
 * 404 Not Found page. Displayed when navigating to a route that does not
 * exist. Logs the attempted path and provides a link back to the dashboard.
 *
 * @features
 * - 404 error display with attempted path
 * - Navigation link back to dashboard
 * - Console logging of invalid routes
 *
 * @dependencies NotFound uses react-router-dom (useLocation), useEffect
 */
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <a href="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
