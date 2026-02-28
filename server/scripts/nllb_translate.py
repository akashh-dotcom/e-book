#!/usr/bin/env python3
"""
NLLB Translation Script for VoxBook.
Translates text from a source language to a target language using Meta's NLLB-200 model.

Supports two modes:
  Single text:
    python nllb_translate.py --input input.txt --output output.txt --src en --tgt ja

  Multiple paragraphs (JSON array):
    python nllb_translate.py --input paras.json --output out.json --src en --tgt ja --json

The model is downloaded on first run (~1.2GB) and cached locally.
"""

import os
import argparse
import sys
import json

# Prevent OpenMP/MKL threading crashes on Windows (exit code 0xC0000005).
# Must be set BEFORE importing torch/transformers.
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
# Allow duplicate OpenMP runtimes (common crash cause when numpy/torch
# ship different libiomp copies on Windows).
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'


def get_nllb_code(lang_code):
    """Map ISO 639-1 / locale codes to NLLB flores-200 codes."""
    mapping = {
        # Common mappings: ISO 639-1 -> NLLB
        'en': 'eng_Latn', 'en-US': 'eng_Latn', 'en-GB': 'eng_Latn', 'en-AU': 'eng_Latn', 'en-IN': 'eng_Latn',
        'es': 'spa_Latn', 'es-ES': 'spa_Latn', 'es-MX': 'spa_Latn', 'es-AR': 'spa_Latn',
        'fr': 'fra_Latn', 'fr-FR': 'fra_Latn', 'fr-CA': 'fra_Latn',
        'de': 'deu_Latn', 'de-DE': 'deu_Latn', 'de-AT': 'deu_Latn', 'de-CH': 'deu_Latn',
        'it': 'ita_Latn', 'it-IT': 'ita_Latn',
        'pt': 'por_Latn', 'pt-BR': 'por_Latn', 'pt-PT': 'por_Latn',
        'nl': 'nld_Latn', 'nl-NL': 'nld_Latn', 'nl-BE': 'nld_Latn',
        'ru': 'rus_Cyrl', 'ru-RU': 'rus_Cyrl',
        'pl': 'pol_Latn', 'pl-PL': 'pol_Latn',
        'uk': 'ukr_Cyrl', 'uk-UA': 'ukr_Cyrl',
        'cs': 'ces_Latn', 'cs-CZ': 'ces_Latn',
        'ro': 'ron_Latn', 'ro-RO': 'ron_Latn',
        'hu': 'hun_Latn', 'hu-HU': 'hun_Latn',
        'sv': 'swe_Latn', 'sv-SE': 'swe_Latn',
        'da': 'dan_Latn', 'da-DK': 'dan_Latn',
        'fi': 'fin_Latn', 'fi-FI': 'fin_Latn',
        'nb': 'nob_Latn', 'nb-NO': 'nob_Latn', 'no': 'nob_Latn',
        'el': 'ell_Grek', 'el-GR': 'ell_Grek',
        'bg': 'bul_Cyrl', 'bg-BG': 'bul_Cyrl',
        'hr': 'hrv_Latn', 'hr-HR': 'hrv_Latn',
        'sk': 'slk_Latn', 'sk-SK': 'slk_Latn',
        'sl': 'slv_Latn', 'sl-SI': 'slv_Latn',
        'sr': 'srp_Cyrl', 'sr-RS': 'srp_Cyrl',
        'lt': 'lit_Latn', 'lt-LT': 'lit_Latn',
        'lv': 'lav_Latn', 'lv-LV': 'lav_Latn',
        'et': 'est_Latn', 'et-EE': 'est_Latn',
        'hi': 'hin_Deva', 'hi-IN': 'hin_Deva',
        'bn': 'ben_Beng', 'bn-IN': 'ben_Beng', 'bn-BD': 'ben_Beng',
        'ta': 'tam_Taml', 'ta-IN': 'tam_Taml',
        'te': 'tel_Telu', 'te-IN': 'tel_Telu',
        'mr': 'mar_Deva', 'mr-IN': 'mar_Deva',
        'gu': 'guj_Gujr', 'gu-IN': 'guj_Gujr',
        'pa': 'pan_Guru', 'pa-IN': 'pan_Guru',
        'kn': 'kan_Knda', 'kn-IN': 'kan_Knda',
        'ml': 'mal_Mlym', 'ml-IN': 'mal_Mlym',
        'ur': 'urd_Arab', 'ur-PK': 'urd_Arab', 'ur-IN': 'urd_Arab',
        'ar': 'arb_Arab', 'ar-SA': 'arb_Arab', 'ar-AE': 'arb_Arab', 'ar-EG': 'arb_Arab',
        'fa': 'pes_Arab', 'fa-IR': 'pes_Arab',
        'he': 'heb_Hebr', 'he-IL': 'heb_Hebr',
        'tr': 'tur_Latn', 'tr-TR': 'tur_Latn',
        'ja': 'jpn_Jpan', 'ja-JP': 'jpn_Jpan',
        'ko': 'kor_Hang', 'ko-KR': 'kor_Hang',
        'zh': 'zho_Hans', 'zh-CN': 'zho_Hans', 'zh-TW': 'zho_Hant', 'zh-HK': 'zho_Hant',
        'th': 'tha_Thai', 'th-TH': 'tha_Thai',
        'vi': 'vie_Latn', 'vi-VN': 'vie_Latn',
        'id': 'ind_Latn', 'id-ID': 'ind_Latn',
        'ms': 'zsm_Latn', 'ms-MY': 'zsm_Latn',
        'tl': 'tgl_Latn', 'fil': 'tgl_Latn', 'fil-PH': 'tgl_Latn',
        'sw': 'swh_Latn', 'sw-KE': 'swh_Latn',
        'af': 'afr_Latn', 'af-ZA': 'afr_Latn',
        'am': 'amh_Ethi', 'am-ET': 'amh_Ethi',
        'my': 'mya_Mymr', 'my-MM': 'mya_Mymr',
        'km': 'khm_Khmr', 'km-KH': 'khm_Khmr',
        'lo': 'lao_Laoo', 'lo-LA': 'lao_Laoo',
        'ne': 'npi_Deva', 'ne-NP': 'npi_Deva',
        'si': 'sin_Sinh', 'si-LK': 'sin_Sinh',
        'ka': 'kat_Geor', 'ka-GE': 'kat_Geor',
        'az': 'azj_Latn', 'az-AZ': 'azj_Latn',
        'uz': 'uzn_Latn', 'uz-UZ': 'uzn_Latn',
        'kk': 'kaz_Cyrl', 'kk-KZ': 'kaz_Cyrl',
        'mn': 'khk_Cyrl', 'mn-MN': 'khk_Cyrl',
        'cy': 'cym_Latn', 'cy-GB': 'cym_Latn',
        'ga': 'gle_Latn', 'ga-IE': 'gle_Latn',
        'mt': 'mlt_Latn', 'mt-MT': 'mlt_Latn',
        'is': 'isl_Latn', 'is-IS': 'isl_Latn',
        'mk': 'mkd_Cyrl', 'mk-MK': 'mkd_Cyrl',
        'sq': 'als_Latn', 'sq-AL': 'als_Latn',
        'bs': 'bos_Latn', 'bs-BA': 'bos_Latn',
        'gl': 'glg_Latn', 'gl-ES': 'glg_Latn',
        'ca': 'cat_Latn', 'ca-ES': 'cat_Latn',
        'eu': 'eus_Latn', 'eu-ES': 'eus_Latn',
    }
    return mapping.get(lang_code, lang_code)


def translate_one(text, tokenizer, model, src_lang, tgt_lang, max_length=512):
    """Translate a single paragraph. Splits into sentence chunks if too long."""
    import re
    import gc
    import torch

    text = text.strip()
    if not text:
        return ''

    # For very short inputs (single words / fragments without punctuation),
    # wrap in a minimal sentence so the model gets enough context tokens.
    # NLLB can segfault on Windows with tiny (1-2 token) inputs.
    short_input = False
    token_count = len(tokenizer.encode(text))
    if token_count <= 4:
        short_input = True
        padded_text = text + ' .'
    else:
        padded_text = text

    sentences = re.split(r'(?<=[.!?])\s+', padded_text)

    # Batch sentences into chunks that fit max_length
    chunks = []
    current_chunk = []
    current_len = 0
    for s in sentences:
        s_len = len(tokenizer.encode(s))
        if current_len + s_len > max_length - 10 and current_chunk:
            chunks.append(' '.join(current_chunk))
            current_chunk = [s]
            current_len = s_len
        else:
            current_chunk.append(s)
            current_len += s_len
    if current_chunk:
        chunks.append(' '.join(current_chunk))

    translated_chunks = []
    tokenizer.src_lang = src_lang

    # Free memory before inference to reduce Windows crash risk.
    gc.collect()

    for chunk in chunks:
        try:
            inputs = tokenizer(chunk, return_tensors="pt", truncation=True,
                               max_length=max_length, padding=True)
            # Use no_grad instead of inference_mode — inference_mode can
            # trigger segfaults on certain Windows PyTorch builds.
            with torch.no_grad():
                translated_tokens = model.generate(
                    **inputs,
                    forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_lang),
                    max_new_tokens=min(max_length, 256),
                    num_beams=1,
                )
            result = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]
            translated_chunks.append(result)
        except Exception as e:
            print(f"CHUNK_ERROR:{e}", file=sys.stderr, flush=True)
            translated_chunks.append(chunk)

    result = ' '.join(translated_chunks)

    # Strip the trailing punctuation we added for short inputs.
    if short_input and result:
        result = re.sub(r'\s*[.\u3002\uFF0E]\s*$', '', result)

    return result


def main():
    parser = argparse.ArgumentParser(description='Translate text using NLLB-200')
    parser.add_argument('--input', required=True, help='Input text file (or JSON array in --json mode)')
    parser.add_argument('--output', required=True, help='Output text file (or JSON array in --json mode)')
    parser.add_argument('--src', required=True, help='Source language code (ISO 639-1 or NLLB code)')
    parser.add_argument('--tgt', required=True, help='Target language code (ISO 639-1 or NLLB code)')
    parser.add_argument('--json', action='store_true', help='JSON mode: input/output are JSON arrays of paragraphs')

    args = parser.parse_args()

    # Resolve language codes
    src_nllb = get_nllb_code(args.src)
    tgt_nllb = get_nllb_code(args.tgt)

    # Load model once
    print("LOADING_MODEL", file=sys.stderr, flush=True)
    import gc
    import torch
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, AutoConfig
    model_name = "facebook/nllb-200-distilled-600M"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    # Explicitly set tie_word_embeddings=False to silence warnings and
    # prevent potential weight-shape mismatches during generation.
    config = AutoConfig.from_pretrained(model_name)
    config.tie_word_embeddings = False
    model = AutoModelForSeq2SeqLM.from_pretrained(
        model_name, config=config, low_cpu_mem_usage=True
    )
    model.eval()
    gc.collect()
    print("MODEL_READY", file=sys.stderr, flush=True)

    if args.json:
        # JSON mode: translate array of paragraphs individually
        with open(args.input, 'r', encoding='utf-8') as f:
            paragraphs = json.load(f)

        total = len(paragraphs)
        translated = []
        errors = 0

        for idx, para in enumerate(paragraphs):
            try:
                result = translate_one(para, tokenizer, model, src_nllb, tgt_nllb)
                translated.append(result)
            except Exception as e:
                print(f"PARAGRAPH_ERROR:{idx}:{e}", file=sys.stderr, flush=True)
                translated.append(para)  # fallback to original text
                errors += 1

            pct = round(((idx + 1) / total) * 100)
            print(f"PROGRESS:{idx + 1}/{total}/{pct}", file=sys.stderr, flush=True)

        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(translated, f, ensure_ascii=False)

        print(json.dumps({
            "success": True,
            "src": src_nllb,
            "tgt": tgt_nllb,
            "paragraphs": total,
            "errors": errors,
        }))
    else:
        # Legacy single-text mode
        with open(args.input, 'r', encoding='utf-8') as f:
            text = f.read().strip()

        if not text:
            print(json.dumps({"error": "Empty input text"}))
            sys.exit(1)

        try:
            translated = translate_one(text, tokenizer, model, src_nllb, tgt_nllb)
        except Exception as e:
            print(json.dumps({"error": f"Translation failed: {e}"}))
            sys.exit(1)

        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(translated)

        print(json.dumps({
            "success": True,
            "src": src_nllb,
            "tgt": tgt_nllb,
            "input_length": len(text),
            "output_length": len(translated),
        }))


if __name__ == '__main__':
    main()
