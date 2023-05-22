import { useRouteError, Link } from "react-router-dom";

export const Error = () => {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="page-wrapper">
      <div className="content pb-20">
        <div className="card">
          <h2 className="text-center">An error occurred...</h2>
          <div
            className="card text-center"
            style={{ backgroundColor: "#1e2125" }}
          >
            <div className="mb-20">Something went wrong...</div>
            <Link to="/" replace className="btn btn-primary">
              Go back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
