use crate::error::Result;

/// 使用 cl100k_base tokenizer（GPT-4 / Claude 系列）计算文本的 token 数量
pub fn count_tokens(text: &str) -> Result<usize> {
    let bpe = tiktoken_rs::cl100k_base()
        .map_err(|e| crate::error::ContextKitError::InvalidPath(format!("tiktoken init failed: {e}")))?;
    let tokens = bpe.encode_with_special_tokens(text);
    Ok(tokens.len())
}

/// 计算文件内容的 token 数量
pub fn count_tokens_in_file(path: &std::path::Path) -> Result<usize> {
    let content = std::fs::read_to_string(path)?;
    count_tokens(&content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn count_tokens_empty() {
        assert_eq!(count_tokens("").unwrap(), 0);
    }

    #[test]
    fn count_tokens_simple_english() {
        // "Hello world" should be around 2-3 tokens
        let count = count_tokens("Hello world").unwrap();
        assert!(count > 0 && count < 10, "Expected 2-3 tokens, got {count}");
    }

    #[test]
    fn count_tokens_longer_text() {
        let text = "The quick brown fox jumps over the lazy dog.";
        let count = count_tokens(text).unwrap();
        assert!(count >= 9, "Expected at least 9 tokens for a 9-word sentence, got {count}");
    }

    #[test]
    fn count_tokens_chinese() {
        // Chinese characters typically take more tokens
        let text = "你好世界";
        let count = count_tokens(text).unwrap();
        assert!(count > 0, "Chinese text should have tokens");
    }

    #[test]
    fn count_tokens_code() {
        let code = r#"fn main() {
    println!("Hello");
}"#;
        let count = count_tokens(code).unwrap();
        assert!(count > 5, "Code should have multiple tokens, got {count}");
    }

    #[test]
    fn count_tokens_is_consistent() {
        let text = "Consistency is key.";
        let count1 = count_tokens(text).unwrap();
        let count2 = count_tokens(text).unwrap();
        assert_eq!(count1, count2);
    }
}
