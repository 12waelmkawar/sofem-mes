import { Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<div>Login Page (Coming Soon)</div>} />
      <Route path="/admin" element={<div>Admin Dashboard (Coming Soon)</div>} />
      <Route path="/operator" element={<div>Operator Dashboard (Coming Soon)</div>} />
    </Routes>
  );
}

export default App;
