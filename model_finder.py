# model_finder.py
import streamlit as st
import os
import google.generativeai as genai

st.title("🔍 Gemini Model Finder")

# Get API Key from Environment Variable (for Render/Production)
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    st.error("GEMINI_API_KEY is not configured.")
    st.stop()

genai.configure(api_key=api_key)

st.write("Listing all available models for your API key...")

try:
    models = genai.list_models()
    for model in models:
        # We only care about models that can generate content
        if 'generateContent' in model.supported_generation_methods:
            st.code(f"Model Name: {model.name}")
except Exception as e:
    st.error(f"An error occurred: {e}")
