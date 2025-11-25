import React from 'react'
import {Routes,Route} from 'react-router-dom'
import { Toaster } from "react-hot-toast";
import Register from './pages/Register';

const App = () => {
  return (
    <>
      <Toaster/>
      <Routes>

        <Route path='/' element={<Register/>}/>
      </Routes>



    </>
  )
}

export default App
