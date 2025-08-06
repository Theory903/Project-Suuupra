# Ledger Service - Implementation TODO

## 📋 Overview
Enterprise-grade double-entry accounting ledger with ACID transactions, automated reconciliation, cryptographic hash chains, and Spring Batch processing. Designed for financial data integrity and audit compliance.

**Target Implementation:** Weeks 9-10
**Performance Goals:** 99.99% data consistency, <100ms transaction processing
**Scale:** 10M+ transactions/day with real-time balance updates

---

## 🏗️ Core Architecture Implementation

### Week 9: Day 1-3 - Spring Boot Foundation & Database Schema

#### Maven Dependencies Setup
- [ ] **Spring Boot Project Structure**
  ```xml
  <dependencies>
      <dependency>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-web</artifactId>
      </dependency>
      <dependency>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-data-jpa</artifactId>
      </dependency>
      <dependency>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-batch</artifactId>
      </dependency>
      <dependency>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-security</artifactId>
      </dependency>
      <dependency>
          <groupId>mysql</groupId>
          <artifactId>mysql-connector-java</artifactId>
      </dependency>
      <dependency>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-redis</artifactId>
      </dependency>
  </dependencies>
  ```

#### Double-Entry Ledger Schema
- [ ] **Chart of Accounts**
  ```sql
  CREATE TABLE chart_of_accounts (
      id VARCHAR(36) PRIMARY KEY,
      account_code VARCHAR(20) UNIQUE NOT NULL,
      account_name VARCHAR(100) NOT NULL,
      account_type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
      parent_account_id VARCHAR(36),
      is_active BOOLEAN DEFAULT TRUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(id),
      INDEX idx_account_code (account_code),
      INDEX idx_account_type (account_type),
      INDEX idx_parent_account (parent_account_id)
  );
  ```

- [ ] **Transactions Table**
  ```sql
  CREATE TABLE transactions (
      id VARCHAR(36) PRIMARY KEY,
      transaction_number VARCHAR(50) UNIQUE NOT NULL,
      reference_id VARCHAR(100), -- External reference (payment_id, order_id)
      transaction_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      total_amount DECIMAL(19,4) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      transaction_date DATE NOT NULL,
      posting_date DATE NOT NULL,
      status ENUM('PENDING', 'POSTED', 'REVERSED', 'CANCELLED') DEFAULT 'PENDING',
      source_system VARCHAR(50) NOT NULL, -- 'PAYMENT_GATEWAY', 'ECOMMERCE', etc.
      created_by VARCHAR(36) NOT NULL,
      hash_value VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity
      previous_hash VARCHAR(64), -- For blockchain-style chain
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      posted_at TIMESTAMP NULL,
      INDEX idx_transaction_number (transaction_number),
      INDEX idx_reference_id (reference_id),
      INDEX idx_transaction_date (transaction_date),
      INDEX idx_status (status),
      INDEX idx_source_system (source_system)
  );
  ```

- [ ] **Journal Entries Table**
  ```sql
  CREATE TABLE journal_entries (
      id VARCHAR(36) PRIMARY KEY,
      transaction_id VARCHAR(36) NOT NULL,
      account_id VARCHAR(36) NOT NULL,
      debit_amount DECIMAL(19,4) DEFAULT 0.0000,
      credit_amount DECIMAL(19,4) DEFAULT 0.0000,
      balance_after DECIMAL(19,4) NOT NULL,
      description TEXT,
      entry_sequence INT NOT NULL, -- Order within transaction
      hash_value VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
      INDEX idx_transaction_id (transaction_id),
      INDEX idx_account_id (account_id),
      INDEX idx_transaction_account (transaction_id, account_id),
      CONSTRAINT chk_debit_credit CHECK (
          (debit_amount > 0 AND credit_amount = 0) OR 
          (credit_amount > 0 AND debit_amount = 0)
      )
  );
  ```

- [ ] **Account Balances Table**
  ```sql
  CREATE TABLE account_balances (
      id VARCHAR(36) PRIMARY KEY,
      account_id VARCHAR(36) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      balance DECIMAL(19,4) DEFAULT 0.0000,
      last_transaction_id VARCHAR(36),
      balance_date DATE NOT NULL,
      version BIGINT DEFAULT 1, -- Optimistic locking
      hash_value VARCHAR(64) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
      FOREIGN KEY (last_transaction_id) REFERENCES transactions(id),
      UNIQUE KEY uk_account_currency_date (account_id, currency, balance_date),
      INDEX idx_account_balance (account_id, currency),
      INDEX idx_balance_date (balance_date)
  );
  ```

#### Core Entity Classes
- [ ] **Transaction Entity**
  ```java
  @Entity
  @Table(name = "transactions")
  public class Transaction {
      @Id
      private String id;
      
      @Column(unique = true)
      private String transactionNumber;
      
      private String referenceId;
      private String transactionType;
      private String description;
      
      @Column(precision = 19, scale = 4)
      private BigDecimal totalAmount;
      
      private String currency;
      private LocalDate transactionDate;
      private LocalDate postingDate;
      
      @Enumerated(EnumType.STRING)
      private TransactionStatus status;
      
      private String sourceSystem;
      private String createdBy;
      private String hashValue;
      private String previousHash;
      
      @OneToMany(mappedBy = "transaction", cascade = CascadeType.ALL)
      private List<JournalEntry> journalEntries;
      
      // Constructors, getters, setters
  }
  ```

### Week 9: Day 4-5 - Double-Entry Service Implementation

- [ ] **Ledger Service Core**
  ```java
  @Service
  @Transactional
  public class LedgerService {
      
      @Autowired
      private TransactionRepository transactionRepository;
      
      @Autowired
      private JournalEntryRepository journalEntryRepository;
      
      @Autowired
      private AccountBalanceService accountBalanceService;
      
      @Autowired
      private HashService hashService;
      
      public Transaction createTransaction(CreateTransactionRequest request) {
          validateDoubleEntry(request.getJournalEntries());
          
          Transaction transaction = buildTransaction(request);
          transaction.setHashValue(hashService.calculateTransactionHash(transaction));
          
          // Save transaction
          transaction = transactionRepository.save(transaction);
          
          // Process journal entries
          for (JournalEntryRequest entryRequest : request.getJournalEntries()) {
              JournalEntry entry = buildJournalEntry(transaction, entryRequest);
              entry.setHashValue(hashService.calculateEntryHash(entry));
              
              // Update account balance atomically
              BigDecimal newBalance = accountBalanceService.updateBalance(
                  entry.getAccountId(), 
                  entry.getDebitAmount().subtract(entry.getCreditAmount()),
                  transaction.getId()
              );
              
              entry.setBalanceAfter(newBalance);
              journalEntryRepository.save(entry);
          }
          
          transaction.setStatus(TransactionStatus.POSTED);
          transaction.setPostedAt(Instant.now());
          
          return transactionRepository.save(transaction);
      }
      
      private void validateDoubleEntry(List<JournalEntryRequest> entries) {
          BigDecimal totalDebits = BigDecimal.ZERO;
          BigDecimal totalCredits = BigDecimal.ZERO;
          
          for (JournalEntryRequest entry : entries) {
              totalDebits = totalDebits.add(entry.getDebitAmount());
              totalCredits = totalCredits.add(entry.getCreditAmount());
              
              // Validate entry has either debit or credit, not both
              if (entry.getDebitAmount().compareTo(BigDecimal.ZERO) > 0 && 
                  entry.getCreditAmount().compareTo(BigDecimal.ZERO) > 0) {
                  throw new InvalidJournalEntryException("Entry cannot have both debit and credit amounts");
              }
          }
          
          if (totalDebits.compareTo(totalCredits) != 0) {
              throw new DoubleEntryViolationException(
                  String.format("Total debits (%s) must equal total credits (%s)", 
                      totalDebits, totalCredits)
              );
          }
      }
  }
  ```

- [ ] **Account Balance Service**
  ```java
  @Service
  public class AccountBalanceService {
      
      @Autowired
      private AccountBalanceRepository balanceRepository;
      
      @Autowired
      private HashService hashService;
      
      @Lock(LockModeType.PESSIMISTIC_WRITE)
      @Transactional(isolation = Isolation.SERIALIZABLE)
      public BigDecimal updateBalance(String accountId, BigDecimal amount, String transactionId) {
          AccountBalance balance = balanceRepository.findByAccountIdAndCurrency(accountId, "INR")
              .orElseGet(() -> createNewBalance(accountId));
          
          // Optimistic locking check
          Long currentVersion = balance.getVersion();
          
          BigDecimal newBalance = balance.getBalance().add(amount);
          balance.setBalance(newBalance);
          balance.setLastTransactionId(transactionId);
          balance.setBalanceDate(LocalDate.now());
          balance.setVersion(currentVersion + 1);
          balance.setHashValue(hashService.calculateBalanceHash(balance));
          
          try {
              AccountBalance savedBalance = balanceRepository.save(balance);
              return savedBalance.getBalance();
          } catch (OptimisticLockingFailureException e) {
              throw new ConcurrentUpdateException("Balance updated by another transaction", e);
          }
      }
      
      public BigDecimal getBalance(String accountId, String currency) {
          return balanceRepository.findByAccountIdAndCurrency(accountId, currency)
              .map(AccountBalance::getBalance)
              .orElse(BigDecimal.ZERO);
      }
  }
  ```

---

## 🔗 Cryptographic Hash Chain Implementation

### Week 9: Day 6-7 - Merkle Tree & Hash Chain

- [] **Hash Service Implementation**
  ```java
  @Service
  public class HashService {
      
      private final MessageDigest sha256;
      
      public HashService() throws NoSuchAlgorithmException {
          this.sha256 = MessageDigest.getInstance("SHA-256");
      }
      
      public String calculateTransactionHash(Transaction transaction) {
          String data = String.join("|",
              transaction.getId(),
              transaction.getTransactionNumber(),
              transaction.getReferenceId(),
              transaction.getTotalAmount().toString(),
              transaction.getCurrency(),
              transaction.getTransactionDate().toString(),
              transaction.getSourceSystem(),
              String.valueOf(transaction.getCreatedAt().toEpochMilli())
          );
          
          return hashString(data);
      }
      
      public String calculateEntryHash(JournalEntry entry) {
          String data = String.join("|",
              entry.getId(),
              entry.getTransactionId(),
              entry.getAccountId(),
              entry.getDebitAmount().toString(),
              entry.getCreditAmount().toString(),
              entry.getBalanceAfter().toString(),
              String.valueOf(entry.getEntrySequence())
          );
          
          return hashString(data);
      }
      
      public String calculateMerkleRoot(List<String> hashes) {
          if (hashes.isEmpty()) return "";
          if (hashes.size() == 1) return hashes.get(0);
          
          List<String> nextLevel = new ArrayList<>();
          
          for (int i = 0; i < hashes.size(); i += 2) {
              String left = hashes.get(i);
              String right = i + 1 < hashes.size() ? hashes.get(i + 1) : left;
              
              nextLevel.add(hashString(left + right));
          }
          
          return calculateMerkleRoot(nextLevel);
      }
      
      private String hashString(String data) {
          byte[] hash = sha256.digest(data.getBytes(StandardCharsets.UTF_8));
          return bytesToHex(hash);
      }
      
      private String bytesToHex(byte[] bytes) {
          StringBuilder result = new StringBuilder();
          for (byte b : bytes) {
              result.append(String.format("%02x", b));
          }
          return result.toString();
      }
  }
  ```

- [ ] **Hash Chain Integrity Service**
  ```java
  @Service
  public class IntegrityService {
      
      @Autowired
      private TransactionRepository transactionRepository;
      
      @Autowired
      private HashService hashService;
      
      @Scheduled(fixedRate = 3600000) // Every hour
      public void verifyHashChainIntegrity() {
          log.info("Starting hash chain integrity verification");
          
          List<Transaction> transactions = transactionRepository
              .findAllByStatusOrderByCreatedAt(TransactionStatus.POSTED);
          
          String previousHash = null;
          int verifiedCount = 0;
          int errorCount = 0;
          
          for (Transaction tx : transactions) {
              // Verify transaction hash
              String calculatedHash = hashService.calculateTransactionHash(tx);
              if (!calculatedHash.equals(tx.getHashValue())) {
                  log.error("Hash mismatch for transaction {}: expected {}, got {}", 
                      tx.getId(), tx.getHashValue(), calculatedHash);
                  errorCount++;
                  continue;
              }
              
              // Verify chain integrity
              if (previousHash != null && !previousHash.equals(tx.getPreviousHash())) {
                  log.error("Chain break at transaction {}: expected previous hash {}, got {}", 
                      tx.getId(), previousHash, tx.getPreviousHash());
                  errorCount++;
                  continue;
              }
              
              previousHash = tx.getHashValue();
              verifiedCount++;
          }
          
          log.info("Hash chain verification complete: {} verified, {} errors", 
              verifiedCount, errorCount);
          
          // Alert if errors found
          if (errorCount > 0) {
              alertService.sendCriticalAlert("Hash chain integrity compromised", 
                  String.format("Found %d integrity violations", errorCount));
          }
      }
      
      public boolean verifyTransactionIntegrity(String transactionId) {
          Transaction transaction = transactionRepository.findById(transactionId)
              .orElseThrow(() -> new TransactionNotFoundException(transactionId));
          
          String calculatedHash = hashService.calculateTransactionHash(transaction);
          return calculatedHash.equals(transaction.getHashValue());
      }
  }
  ```

---

## 🔄 Automated Reconciliation Engine

### Week 10: Day 1-3 - Bank Statement Reconciliation

- [ ] **Bank Statement Import Service**
  ```java
  @Service
  public class BankReconciliationService {
      
      @Autowired
      private BankStatementRepository bankStatementRepository;
      
      @Autowired
      private TransactionRepository transactionRepository;
      
      @Autowired
      private ReconciliationReportService reportService;
      
      public ReconciliationResult reconcileBankStatement(String bankAccountId, LocalDate reconciliationDate) {
          // Fetch bank statement
          List<BankStatementEntry> bankEntries = bankStatementRepository
              .findByAccountIdAndTransactionDate(bankAccountId, reconciliationDate);
          
          // Fetch internal transactions
          List<Transaction> internalTransactions = transactionRepository
              .findBySourceSystemAndTransactionDate("BANK_TRANSFER", reconciliationDate);
          
          // Match transactions
          ReconciliationMatcher matcher = new ReconciliationMatcher();
          MatchingResult matchingResult = matcher.matchTransactions(bankEntries, internalTransactions);
          
          // Process results
          ReconciliationResult result = new ReconciliationResult();
          result.setReconciliationDate(reconciliationDate);
          result.setTotalBankEntries(bankEntries.size());
          result.setTotalInternalEntries(internalTransactions.size());
          result.setMatchedEntries(matchingResult.getMatches().size());
          result.setUnmatchedBankEntries(matchingResult.getUnmatchedBankEntries());
          result.setUnmatchedInternalEntries(matchingResult.getUnmatchedInternalEntries());
          
          // Generate reconciliation entries for matches
          for (TransactionMatch match : matchingResult.getMatches()) {
              createReconciliationEntry(match);
          }
          
          // Generate exception report for unmatched items
          reportService.generateExceptionReport(result);
          
          return result;
      }
      
      private void createReconciliationEntry(TransactionMatch match) {
          Transaction reconciliationTx = new Transaction();
          reconciliationTx.setId(UUID.randomUUID().toString());
          reconciliationTx.setTransactionType("RECONCILIATION");
          reconciliationTx.setDescription("Bank reconciliation entry");
          reconciliationTx.setReferenceId(match.getBankEntry().getTransactionId());
          reconciliationTx.setSourceSystem("RECONCILIATION_ENGINE");
          
          // Create offsetting journal entries
          List<JournalEntry> entries = Arrays.asList(
              createJournalEntry(reconciliationTx.getId(), "BANK_ACCOUNT", 
                  match.getBankEntry().getAmount(), BigDecimal.ZERO),
              createJournalEntry(reconciliationTx.getId(), "RECONCILIATION_CLEARING", 
                  BigDecimal.ZERO, match.getBankEntry().getAmount())
          );
          
          reconciliationTx.setJournalEntries(entries);
          transactionRepository.save(reconciliationTx);
      }
  }
  ```

- [ ] **Intelligent Transaction Matching**
  ```java
  @Component
  public class ReconciliationMatcher {
      
      public MatchingResult matchTransactions(List<BankStatementEntry> bankEntries, 
                                            List<Transaction> internalTransactions) {
          MatchingResult result = new MatchingResult();
          Set<String> matchedBankIds = new HashSet<>();
          Set<String> matchedInternalIds = new HashSet<>();
          
          // Exact matching by reference and amount
          for (BankStatementEntry bankEntry : bankEntries) {
              for (Transaction internalTx : internalTransactions) {
                  if (isExactMatch(bankEntry, internalTx)) {
                      result.addMatch(new TransactionMatch(bankEntry, internalTx, MatchType.EXACT));
                      matchedBankIds.add(bankEntry.getId());
                      matchedInternalIds.add(internalTx.getId());
                      break;
                  }
              }
          }
          
          // Fuzzy matching by amount and date range
          for (BankStatementEntry bankEntry : bankEntries) {
              if (matchedBankIds.contains(bankEntry.getId())) continue;
              
              for (Transaction internalTx : internalTransactions) {
                  if (matchedInternalIds.contains(internalTx.getId())) continue;
                  
                  if (isFuzzyMatch(bankEntry, internalTx)) {
                      result.addMatch(new TransactionMatch(bankEntry, internalTx, MatchType.FUZZY));
                      matchedBankIds.add(bankEntry.getId());
                      matchedInternalIds.add(internalTx.getId());
                      break;
                  }
              }
          }
          
          // Collect unmatched entries
          for (BankStatementEntry entry : bankEntries) {
              if (!matchedBankIds.contains(entry.getId())) {
                  result.addUnmatchedBankEntry(entry);
              }
          }
          
          for (Transaction tx : internalTransactions) {
              if (!matchedInternalIds.contains(tx.getId())) {
                  result.addUnmatchedInternalEntry(tx);
              }
          }
          
          return result;
      }
      
      private boolean isExactMatch(BankStatementEntry bankEntry, Transaction internalTx) {
          return bankEntry.getAmount().equals(internalTx.getTotalAmount()) &&
                 bankEntry.getReference().equals(internalTx.getReferenceId()) &&
                 bankEntry.getTransactionDate().equals(internalTx.getTransactionDate());
      }
      
      private boolean isFuzzyMatch(BankStatementEntry bankEntry, Transaction internalTx) {
          // Amount must match exactly
          if (!bankEntry.getAmount().equals(internalTx.getTotalAmount())) {
              return false;
          }
          
          // Date within 3 days
          long daysDifference = ChronoUnit.DAYS.between(
              bankEntry.getTransactionDate(), 
              internalTx.getTransactionDate()
          );
          
          return Math.abs(daysDifference) <= 3;
      }
  }
  ```

### Week 10: Day 4-5 - Spring Batch Settlement Processing

- [ ] **Settlement Batch Job Configuration**
  ```java
  @Configuration
  @EnableBatchProcessing
  public class SettlementBatchConfig {
      
      @Autowired
      private JobBuilderFactory jobBuilderFactory;
      
      @Autowired
      private StepBuilderFactory stepBuilderFactory;
      
      @Bean
      public Job dailySettlementJob() {
          return jobBuilderFactory.get("dailySettlementJob")
              .start(extractPendingSettlementsStep())
              .next(calculateNetAmountsStep())
              .next(generateSettlementEntriesStep())
              .next(validateSettlementBalancesStep())
              .next(publishSettlementEventsStep())
              .build();
      }
      
      @Bean
      public Step extractPendingSettlementsStep() {
          return stepBuilderFactory.get("extractPendingSettlements")
              .<PendingSettlement, PendingSettlement>chunk(1000)
              .reader(pendingSettlementReader())
              .processor(settlementProcessor())
              .writer(settlementWriter())
              .build();
      }
      
      @Bean
      public ItemReader<PendingSettlement> pendingSettlementReader() {
          JdbcCursorItemReader<PendingSettlement> reader = new JdbcCursorItemReader<>();
          reader.setDataSource(dataSource);
          reader.setSql("""
              SELECT merchant_id, currency, SUM(amount) as total_amount, 
                     COUNT(*) as transaction_count
              FROM transactions 
              WHERE status = 'POSTED' 
                AND settlement_status = 'PENDING' 
                AND transaction_date = ?
              GROUP BY merchant_id, currency
              """);
          reader.setRowMapper(new PendingSettlementRowMapper());
          return reader;
      }
      
      @Bean
      public ItemProcessor<PendingSettlement, SettlementEntry> settlementProcessor() {
          return new SettlementProcessor();
      }
      
      @Bean
      public ItemWriter<SettlementEntry> settlementWriter() {
          return new SettlementWriter();
      }
  }
  
  @Component
  public class SettlementProcessor implements ItemProcessor<PendingSettlement, SettlementEntry> {
      
      @Override
      public SettlementEntry process(PendingSettlement pending) throws Exception {
          // Calculate settlement fees
          BigDecimal fees = calculateSettlementFees(pending.getTotalAmount());
          BigDecimal netAmount = pending.getTotalAmount().subtract(fees);
          
          SettlementEntry entry = new SettlementEntry();
          entry.setMerchantId(pending.getMerchantId());
          entry.setGrossAmount(pending.getTotalAmount());
          entry.setFees(fees);
          entry.setNetAmount(netAmount);
          entry.setCurrency(pending.getCurrency());
          entry.setTransactionCount(pending.getTransactionCount());
          entry.setSettlementDate(LocalDate.now());
          entry.setStatus(SettlementStatus.CALCULATED);
          
          return entry;
      }
      
      private BigDecimal calculateSettlementFees(BigDecimal amount) {
          // 2% settlement fee
          return amount.multiply(new BigDecimal("0.02"));
      }
  }
  ```

- [ ] **Settlement Transaction Generator**
  ```java
  @Service
  public class SettlementTransactionService {
      
      @Autowired
      private LedgerService ledgerService;
      
      @Transactional
      public void generateSettlementTransactions(List<SettlementEntry> settlements) {
          for (SettlementEntry settlement : settlements) {
              // Create settlement transaction
              CreateTransactionRequest request = new CreateTransactionRequest();
              request.setTransactionType("DAILY_SETTLEMENT");
              request.setDescription(String.format("Daily settlement for merchant %s", 
                  settlement.getMerchantId()));
              request.setReferenceId(settlement.getId());
              request.setSourceSystem("SETTLEMENT_ENGINE");
              
              List<JournalEntryRequest> entries = new ArrayList<>();
              
              // Credit merchant account
              entries.add(JournalEntryRequest.builder()
                  .accountId("MERCHANT:" + settlement.getMerchantId())
                  .creditAmount(settlement.getNetAmount())
                  .debitAmount(BigDecimal.ZERO)
                  .description("Settlement credit")
                  .build());
              
              // Debit settlement pool
              entries.add(JournalEntryRequest.builder()
                  .accountId("SETTLEMENT_POOL")
                  .debitAmount(settlement.getNetAmount())
                  .creditAmount(BigDecimal.ZERO)
                  .description("Settlement pool debit")
                  .build());
              
              // Credit fee income account
              if (settlement.getFees().compareTo(BigDecimal.ZERO) > 0) {
                  entries.add(JournalEntryRequest.builder()
                      .accountId("FEE_INCOME")
                      .creditAmount(settlement.getFees())
                      .debitAmount(BigDecimal.ZERO)
                      .description("Settlement fees")
                      .build());
                  
                  entries.add(JournalEntryRequest.builder()
                      .accountId("SETTLEMENT_POOL")
                      .debitAmount(settlement.getFees())
                      .creditAmount(BigDecimal.ZERO)
                      .description("Settlement fees debit")
                      .build());
              }
              
              request.setJournalEntries(entries);
              
              Transaction transaction = ledgerService.createTransaction(request);
              settlement.setTransactionId(transaction.getId());
              settlement.setStatus(SettlementStatus.POSTED);
          }
      }
  }
  ```

---

## 📊 Financial Reporting & Audit Trail

### Week 10: Day 6-7 - Reporting Engine

- [ ] **Trial Balance Generator**
  ```java
  @Service
  public class FinancialReportingService {
      
      @Autowired
      private AccountBalanceRepository balanceRepository;
      
      @Autowired
      private ChartOfAccountsRepository accountsRepository;
      
      public TrialBalance generateTrialBalance(LocalDate asOfDate) {
          List<AccountBalance> balances = balanceRepository.findByBalanceDateLessThanEqual(asOfDate);
          
          TrialBalance trialBalance = new TrialBalance();
          trialBalance.setAsOfDate(asOfDate);
          trialBalance.setGeneratedAt(Instant.now());
          
          BigDecimal totalDebits = BigDecimal.ZERO;
          BigDecimal totalCredits = BigDecimal.ZERO;
          
          List<TrialBalanceEntry> entries = new ArrayList<>();
          
          for (AccountBalance balance : balances) {
              ChartOfAccount account = accountsRepository.findById(balance.getAccountId())
                  .orElseThrow();
              
              TrialBalanceEntry entry = new TrialBalanceEntry();
              entry.setAccountId(account.getId());
              entry.setAccountCode(account.getAccountCode());
              entry.setAccountName(account.getAccountName());
              entry.setAccountType(account.getAccountType());
              
              // Determine debit/credit based on account type and balance
              if (isDebitBalance(account.getAccountType(), balance.getBalance())) {
                  entry.setDebitBalance(balance.getBalance().abs());
                  entry.setCreditBalance(BigDecimal.ZERO);
                  totalDebits = totalDebits.add(balance.getBalance().abs());
              } else {
                  entry.setDebitBalance(BigDecimal.ZERO);
                  entry.setCreditBalance(balance.getBalance().abs());
                  totalCredits = totalCredits.add(balance.getBalance().abs());
              }
              
              entries.add(entry);
          }
          
          trialBalance.setEntries(entries);
          trialBalance.setTotalDebits(totalDebits);
          trialBalance.setTotalCredits(totalCredits);
          trialBalance.setInBalance(totalDebits.equals(totalCredits));
          
          return trialBalance;
      }
      
      private boolean isDebitBalance(AccountType accountType, BigDecimal balance) {
          switch (accountType) {
              case ASSET:
              case EXPENSE:
                  return balance.compareTo(BigDecimal.ZERO) >= 0;
              case LIABILITY:
              case EQUITY:
              case REVENUE:
                  return balance.compareTo(BigDecimal.ZERO) < 0;
              default:
                  return false;
          }
      }
  }
  ```

- [ ] **Audit Trail Service**
  ```java
  @Service
  public class AuditTrailService {
      
      @Autowired
      private AuditLogRepository auditLogRepository;
      
      @EventListener
      public void handleTransactionCreated(TransactionCreatedEvent event) {
          AuditLog auditLog = new AuditLog();
          auditLog.setId(UUID.randomUUID().toString());
          auditLog.setEntityType("TRANSACTION");
          auditLog.setEntityId(event.getTransactionId());
          auditLog.setAction("CREATE");
          auditLog.setUserId(event.getUserId());
          auditLog.setTimestamp(Instant.now());
          auditLog.setOldValue(null);
          auditLog.setNewValue(objectMapper.writeValueAsString(event.getTransaction()));
          auditLog.setIpAddress(event.getIpAddress());
          auditLog.setUserAgent(event.getUserAgent());
          
          auditLogRepository.save(auditLog);
      }
      
      public List<AuditLog> getAuditTrail(String entityId, LocalDateTime from, LocalDateTime to) {
          return auditLogRepository.findByEntityIdAndTimestampBetweenOrderByTimestamp(
              entityId, from.atZone(ZoneId.systemDefault()).toInstant(),
              to.atZone(ZoneId.systemDefault()).toInstant()
          );
      }
      
      public AuditReport generateAuditReport(String entityType, LocalDate from, LocalDate to) {
          List<AuditLog> logs = auditLogRepository.findByEntityTypeAndTimestampBetween(
              entityType, 
              from.atStartOfDay(ZoneId.systemDefault()).toInstant(),
              to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()
          );
          
          AuditReport report = new AuditReport();
          report.setEntityType(entityType);
          report.setFromDate(from);
          report.setToDate(to);
          report.setTotalActions(logs.size());
          report.setActionBreakdown(logs.stream()
              .collect(groupingBy(AuditLog::getAction, counting())));
          report.setUserBreakdown(logs.stream()
              .collect(groupingBy(AuditLog::getUserId, counting())));
          
          return report;
      }
  }
  ```

---

## 🧪 Testing Strategy

### Comprehensive Test Coverage

- [ ] **Unit Tests**
  ```java
  @ExtendWith(MockitoExtension.class)
  class LedgerServiceTest {
      
      @Mock
      private TransactionRepository transactionRepository;
      
      @Mock
      private AccountBalanceService accountBalanceService;
      
      @InjectMocks
      private LedgerService ledgerService;
      
      @Test
      void shouldCreateValidDoubleEntryTransaction() {
          // Given
          CreateTransactionRequest request = new CreateTransactionRequest();
          request.setJournalEntries(Arrays.asList(
              createJournalEntry("CASH", new BigDecimal("1000"), BigDecimal.ZERO),
              createJournalEntry("SALES", BigDecimal.ZERO, new BigDecimal("1000"))
          ));
          
          when(accountBalanceService.updateBalance(anyString(), any(), anyString()))
              .thenReturn(new BigDecimal("1000"));
          
          // When
          Transaction result = ledgerService.createTransaction(request);
          
          // Then
          assertThat(result.getStatus()).isEqualTo(TransactionStatus.POSTED);
          assertThat(result.getJournalEntries()).hasSize(2);
          verify(accountBalanceService, times(2)).updateBalance(anyString(), any(), anyString());
      }
      
      @Test
      void shouldRejectUnbalancedTransaction() {
          // Given
          CreateTransactionRequest request = new CreateTransactionRequest();
          request.setJournalEntries(Arrays.asList(
              createJournalEntry("CASH", new BigDecimal("1000"), BigDecimal.ZERO),
              createJournalEntry("SALES", BigDecimal.ZERO, new BigDecimal("500")) // Unbalanced!
          ));
          
          // When & Then
          assertThatThrownBy(() -> ledgerService.createTransaction(request))
              .isInstanceOf(DoubleEntryViolationException.class)
              .hasMessageContaining("debits (1000) must equal credits (500)");
      }
  }
  ```

- [ ] **Integration Tests**
  ```java
  @SpringBootTest
  @Transactional
  @TestPropertySource(properties = {
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.datasource.url=jdbc:h2:mem:testdb"
  })
  class LedgerIntegrationTest {
      
      @Autowired
      private LedgerService ledgerService;
      
      @Autowired
      private TransactionRepository transactionRepository;
      
      @Autowired
      private AccountBalanceService accountBalanceService;
      
      @Test
      void shouldProcessCompletePaymentWorkflow() {
          // Create payment transaction
          Transaction paymentTx = createPaymentTransaction("user123", new BigDecimal("100"));
          
          // Verify balances updated
          BigDecimal userBalance = accountBalanceService.getBalance("USER:user123", "INR");
          BigDecimal merchantBalance = accountBalanceService.getBalance("MERCHANT:merchant456", "INR");
          
          assertThat(userBalance).isEqualTo(new BigDecimal("-100"));
          assertThat(merchantBalance).isEqualTo(new BigDecimal("100"));
          
          // Verify transaction integrity
          assertThat(paymentTx.getHashValue()).isNotNull();
          assertThat(paymentTx.getStatus()).isEqualTo(TransactionStatus.POSTED);
      }
  }
  ```

---

## 📈 Performance & Monitoring

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Transaction Processing** | <100ms | P99 latency for single transaction |
| **Batch Settlement** | 1M transactions/hour | Spring Batch throughput |
| **Balance Query** | <10ms | Account balance retrieval |
| **Reconciliation** | 99.99% accuracy | Automated matching rate |
| **Data Integrity** | 100% | Hash chain verification |

- [ ] **Database Optimization**
  ```sql
  -- Optimized indexes for performance
  CREATE INDEX idx_transactions_date_status ON transactions(transaction_date, status);
  CREATE INDEX idx_journal_entries_account_date ON journal_entries(account_id, created_at);
  CREATE INDEX idx_balances_composite ON account_balances(account_id, currency, balance_date);
  
  -- Partitioning for large tables
  ALTER TABLE journal_entries PARTITION BY RANGE (YEAR(created_at)) (
      PARTITION p2023 VALUES LESS THAN (2024),
      PARTITION p2024 VALUES LESS THAN (2025),
      PARTITION p2025 VALUES LESS THAN (2026)
  );
  ```

- [ ] **Monitoring & Metrics**
  ```java
  @Component
  public class LedgerMetrics {
      
      private final MeterRegistry meterRegistry;
      private final Counter transactionCounter;
      private final Timer transactionTimer;
      private final Gauge balanceAccuracy;
      
      public LedgerMetrics(MeterRegistry meterRegistry) {
          this.meterRegistry = meterRegistry;
          this.transactionCounter = Counter.builder("ledger.transactions.total")
              .description("Total number of transactions processed")
              .tag("type", "all")
              .register(meterRegistry);
              
          this.transactionTimer = Timer.builder("ledger.transaction.duration")
              .description("Transaction processing time")
              .register(meterRegistry);
      }
      
      public void recordTransaction(String type, Duration duration) {
          transactionCounter.increment(Tags.of("type", type));
          transactionTimer.record(duration);
      }
  }
  ```

---

## 🎓 Learning Objectives

### Financial Accounting Concepts
- [ ] **Double-Entry Bookkeeping**
  - Master fundamental accounting equation
  - Understand debit/credit rules for different account types
  - Implement trial balance validation

- [ ] **Financial Data Integrity**
  - Cryptographic hash chains for tamper detection
  - Merkle trees for batch verification
  - Audit trail design patterns

- [ ] **Reconciliation Processes**
  - Bank statement matching algorithms
  - Exception handling and investigation
  - Automated vs. manual reconciliation strategies

### Technical Skills
- [ ] **Spring Batch Processing**
  - Chunk-oriented processing patterns
  - Job scheduling and monitoring
  - Error handling and restart mechanisms

- [ ] **Database Transaction Management**
  - ACID properties implementation
  - Isolation levels and locking strategies
  - Optimistic vs. pessimistic concurrency control

- [ ] **Enterprise Integration Patterns**
  - Event-driven architecture
  - Saga pattern for distributed transactions
  - Message queues for async processing

---

## 🚀 Deployment & Operations

- [ ] **Production Configuration**
  ```yaml
  spring:
    datasource:
      hikari:
        maximum-pool-size: 20
        minimum-idle: 10
        connection-timeout: 30000
    batch:
      job:
        enabled: false # Control job execution
    jpa:
      properties:
        hibernate:
          jdbc:
            batch_size: 1000
  ```

- [ ] **Disaster Recovery**
  - [ ] Database backup and restore procedures
  - [ ] Point-in-time recovery capability
  - [ ] Cross-region replication setup
  - [ ] Data integrity verification tools

- [ ] **Compliance & Security**
  - [ ] SOX compliance for financial data
  - [ ] Role-based access control
  - [ ] Data encryption at rest and in transit
  - [ ] Regular security audits

---

## 📋 Success Criteria

### Definition of Done
- [ ] All double-entry transactions balanced and verified
- [ ] Hash chain integrity maintained
- [ ] Automated reconciliation achieving >99.9% accuracy
- [ ] Spring Batch processing 1M+ transactions/hour
- [ ] Complete audit trail for all operations
- [ ] Financial reports generating correctly
- [ ] Performance benchmarks met
- [ ] Security controls implemented and tested

### Key Performance Indicators
- [ ] **Data Accuracy:** 100% (no tolerance for financial discrepancies)
- [ ] **Processing Speed:** <100ms P99 for transaction processing
- [ ] **Batch Throughput:** 1M+ transactions/hour
- [ ] **Reconciliation Rate:** >99.9% automated matching
- [ ] **System Availability:** >99.99% uptime
- [ ] **Audit Compliance:** 100% transaction traceability

---

*Last Updated: Week 9 Planning*
*Next Review: End of Week 9*
*Critical Success Factor: Zero tolerance for financial data discrepancies*