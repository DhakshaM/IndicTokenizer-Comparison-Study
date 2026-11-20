# Tokenizer Explorer

An interactive tool for comparing 7 tokenization strategies across Hindi, Marathi, and Tamil (Indic languages) for efficient LLM building and Prompt Engineering.

## Strategies Compared
| # | Strategy | Type |
|---|----------|------|
| 1 | Whitespace | Baseline |
| 2 | Word (IndicNLP) | Rule-based |
| 3 | Character (Grapheme Clusters) | Character-level |
| 4 | BPE | Statistical |
| 5 | WordPiece | Statistical |
| 6 | Unigram LM | Probabilistic |
| 7 | Byte-Level BPE | Byte-level |

## Metrics
- **Fertility** — tokens per word
- **OOV Rate** — unknown token fraction
- **NSL** — normalized sequence length
- **CPT** — characters per token
- **PCW** — proportion of continued words

Playground live metrics are aligned with the Kaggle notebook definitions: `words = text.split()` on the same text that is actually encoded (including Tamil cleaning), `CPT = len(text) / len(tokens)`, `NSL = len(tokens) / len(text)`, `PCW` counts a word as fragmented if tokenizing that word in isolation yields more than one token, and `OOV rate` counts tokens equal to the tokenizer's unknown token.

## Views
- **Playground** — color-coded token spans for all strategies, live metric strip
- **Analysis** — corpus metric charts, context window view, cost of tokenization

## Setup

### Requirements
- Python 3.9+
- Node.js 18+

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
git clone --depth 1 https://github.com/anoopkunchukuttan/indic_nlp_resources.git
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

## Data
Trained on [IndicCorpV2](https://huggingface.co/datasets/ai4bharat/IndicCorpV2) — ~105MB per language.

## Project Structure
```
tokenizer-explorer/
├── backend/
│   ├── main.py                  
│   ├── tokenizers_engine.py     
│   ├── requirements.txt
│   └── models/                 
│       ├── hindi_bpe.json
│       ├── hindi_wordpiece.json
│       ├── hindi_unigram.json
│       ├── hindi_bbpe.json
│       └── hindi_all_metrics.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   └── views/
    │       ├── Playground.jsx
    │       ├── Diff.jsx
    │       └── Analysis.jsx
    └── package.json
```
