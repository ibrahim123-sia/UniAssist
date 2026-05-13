import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

export const fetchDepartments = createAsyncThunk(
  "department/fetchAll",
  async (_, { getState }) => {
    try {
      const { data } = await axios.get("/api/department", authHeader(getState));
      if (data.success) return { success: true, departments: data.departments };
      return { success: false, message: data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch departments",
      };
    }
  }
);

export const createDepartment = createAsyncThunk(
  "department/create",
  async ({ code, name, description }, { getState }) => {
    try {
      const { data } = await axios.post(
        "/api/department",
        { code, name, description },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to create department",
      };
    }
  }
);

const departmentSlice = createSlice({
  name: "department",
  initialState: {
    departments: [],
    loading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) {
          state.departments = action.payload.departments;
        }
      })
      .addCase(fetchDepartments.rejected, (state) => {
        state.loading = false;
      });
  },
});

export default departmentSlice.reducer;
