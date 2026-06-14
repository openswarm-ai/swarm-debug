import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { store } from '@/shared/state/store';
import ClaudeThemeProvider from '@/shared/styles/ThemeContext';
import Layout from '@/app/components/Layout/Layout';
import Debugger from '@/app/pages/Debugger/Debugger';
import DependencyGraph from '@/app/pages/DependencyGraph/DependencyGraph';

const Main: React.FC = () => {
  return (
    <Provider store={store}>
      <ClaudeThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Debugger />} />
              <Route path="graph" element={<DependencyGraph />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ClaudeThemeProvider>
    </Provider>
  );
};

export default Main;
