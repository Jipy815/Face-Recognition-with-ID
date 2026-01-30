import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FingerprintScanner from "./Fsite";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FingerprintScanner />} />
      </Routes>
    </Router>
  );
};

export default App;
