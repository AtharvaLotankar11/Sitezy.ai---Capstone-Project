import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedLayout() {
    const { token, user } = useSelector((s) => s.auth);

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
